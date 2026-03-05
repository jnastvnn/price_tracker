import ProductModel from '../models/ProductModel.js';
import AppError from '../utils/AppError.js';
import ResponseFormatter from '../utils/ResponseFormatter.js';

const DEFAULT_PRICE_SERIES_START = '2025-08-20T00:00:00Z';

function clampEmaWindow(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 30;
  return Math.max(2, Math.min(120, Math.floor(parsed)));
}

function normalizeStartDate(value) {
  const raw = value || DEFAULT_PRICE_SERIES_START;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return DEFAULT_PRICE_SERIES_START;
  }
  return date.toISOString();
}

function clampMaxPoints(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 5000;
  return Math.max(200, Math.min(20000, Math.floor(parsed)));
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function computePatienceSeries(rows, horizonDays = 14, patienceEmaWindow = 7) {
  const soldRows = [];
  const byDay = new Map();

  for (const row of rows) {
    const price = row.price === null ? null : parseFloat(row.price);
    if (price === null || !Number.isFinite(price) || price <= 0) continue;

    const postedAt = row.post_time instanceof Date ? row.post_time : new Date(row.post_time);
    const soldAt = row.sold_time instanceof Date ? row.sold_time : new Date(row.sold_time);
    if (Number.isNaN(postedAt.getTime()) || Number.isNaN(soldAt.getTime()) || soldAt < postedAt) {
      continue;
    }

    const isSold = row.is_sold === true || row.is_sold === 't' || row.is_sold === 'true' || row.is_sold === 1;
    if (!isSold) continue;

    const daysToSell = (soldAt.getTime() - postedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (!Number.isFinite(daysToSell) || daysToSell < 0) continue;
    soldRows.push({ daysToSell, price });

    const roundedDay = Math.round(daysToSell);
    if (roundedDay < 0 || roundedDay > horizonDays) continue;
    if (!byDay.has(roundedDay)) byDay.set(roundedDay, []);
    byDay.get(roundedDay).push(price);
  }

  let expA = null;
  let expB = null;
  {
    let sumX = 0;
    let sumY = 0;
    let sumXX = 0;
    let sumXY = 0;
    let n = 0;
    for (const point of soldRows) {
      const x = point.daysToSell;
      const y = Math.log(point.price);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      sumX += x;
      sumY += y;
      sumXX += x * x;
      sumXY += x * y;
      n += 1;
    }
    const denominator = n * sumXX - sumX * sumX;
    if (n >= 2 && denominator !== 0) {
      expB = (n * sumXY - sumX * sumY) / denominator;
      expA = Math.exp((sumY - expB * sumX) / n);
      if (!Number.isFinite(expA) || !Number.isFinite(expB)) {
        expA = null;
        expB = null;
      }
    }
  }

  const smoothing = 2 / (patienceEmaWindow + 1);
  let ema = null;
  const series = [];
  for (let day = 0; day <= horizonDays; day += 1) {
    const prices = byDay.get(day) || [];
    const avgPrice =
      prices.length > 0
        ? round2(prices.reduce((sum, value) => sum + value, 0) / prices.length)
        : null;

    if (avgPrice !== null) {
      ema = ema === null ? avgPrice : avgPrice * smoothing + ema * (1 - smoothing);
    }
    const emaForDay = ema === null ? null : round2(ema);

    let predictedPrice = null;
    if (expA !== null && expB !== null) {
      const predicted = expA * Math.exp(expB * day);
      if (Number.isFinite(predicted)) predictedPrice = round2(Math.max(0, predicted));
    }

    series.push({
      day,
      sold_count: prices.length,
      avg_price: avgPrice,
      ema_price: emaForDay,
      predicted_price: predictedPrice,
    });
  }

  return {
    horizon_days: horizonDays,
    ema_window: patienceEmaWindow,
    sold_samples: soldRows.length,
    series,
  };
}

function formatEmaSeries(rows, emaWindow = 30) {
  const smoothing = 2 / (emaWindow + 1);
  let ema = null;
  const series = [];

  for (const row of rows) {
    const price = row.price === null ? null : parseFloat(row.price);
    if (price === null || !Number.isFinite(price)) continue;
    const postedAt = row.post_time instanceof Date ? row.post_time : new Date(row.post_time);
    if (Number.isNaN(postedAt.getTime())) continue;

    ema = ema === null ? price : price * smoothing + ema * (1 - smoothing);

    const isSold = row.is_sold === true || row.is_sold === 't' || row.is_sold === 'true' || row.is_sold === 1;
    let soldIso = null;
    let daysToSell = null;
    if (isSold && row.sold_time) {
      const soldAt = row.sold_time instanceof Date ? row.sold_time : new Date(row.sold_time);
      if (!Number.isNaN(soldAt.getTime()) && !Number.isNaN(postedAt.getTime()) && soldAt >= postedAt) {
        soldIso = soldAt.toISOString();
        daysToSell = round2((soldAt.getTime() - postedAt.getTime()) / (1000 * 60 * 60 * 24));
      }
    }

    series.push({
      post_time: postedAt.toISOString(),
      listing_count: 1,
      sold_count: soldIso ? 1 : 0,
      is_sold: isSold,
      sold_time: soldIso,
      days_to_sell: daysToSell,
      ema_price: round2(ema),
    });
  }

  const patience = computePatienceSeries(rows, 14, 7);

  return {
    series_type: 'ema_per_listing_from_all_listings',
    ema_window: emaWindow,
    source: 'listing_prices',
    series,
    patience_horizon_days: patience.horizon_days,
    patience_ema_window: patience.ema_window,
    patience_sold_samples: patience.sold_samples,
    patience_0_14: patience.series,
  };
}

const ModelController = {
  // GET /api/models/:modelName/prices
  async pricesByModelName(req, res) {
    const { modelName } = req.params;
    const { categoryId, emaWindow, startDate, maxPoints } = req.query;
    const decodedModelName = decodeURIComponent(modelName);
    const priceHistory = await ProductModel.getModelPriceHistory(
      decodedModelName,
      categoryId,
      normalizeStartDate(startDate),
      clampMaxPoints(maxPoints)
    );
    return ResponseFormatter.success(res, formatEmaSeries(priceHistory, clampEmaWindow(emaWindow)));
  },

  // GET /api/models/prices?model=... or ?modelKey=...
  async prices(req, res) {
    const { model: modelQuery, modelKey, categoryId, emaWindow, startDate, maxPoints } = req.query;
    if (!modelQuery && !modelKey) {
      throw new AppError(400, 'model or modelKey parameter is required');
    }

    if (modelKey) {
      const priceHistory = await ProductModel.getModelPriceHistoryByKey(
        modelKey,
        categoryId,
        normalizeStartDate(startDate),
        clampMaxPoints(maxPoints)
      );
      return ResponseFormatter.success(res, formatEmaSeries(priceHistory, clampEmaWindow(emaWindow)));
    }

    const modelName = decodeURIComponent(modelQuery);
    const priceHistory = await ProductModel.getModelPriceHistory(
      modelName,
      categoryId,
      normalizeStartDate(startDate),
      clampMaxPoints(maxPoints)
    );
    return ResponseFormatter.success(res, formatEmaSeries(priceHistory, clampEmaWindow(emaWindow)));
  },

  // GET /api/models/image?model=... or ?modelKey=...
  async image(req, res) {
    const { model: modelQuery, modelKey } = req.query;
    if (!modelQuery && !modelKey) {
      throw new AppError(400, 'model or modelKey parameter is required');
    }

    const lookup = modelKey ? String(modelKey) : decodeURIComponent(modelQuery);
    const rows = await ProductModel.executeQuery(
      `
      SELECT mi.url
      FROM model_images mi
      JOIN product_models pm ON pm.id = mi.model_id
      WHERE pm.model_key = lower(btrim($1)) OR pm.canonical_name ILIKE $1
      ORDER BY mi.is_primary DESC,
               mi.sort_order ASC,
               mi.id ASC
      LIMIT 1
      `,
      [lookup]
    );

    return ResponseFormatter.success(res, { url: rows[0]?.url || null });
  },

  // GET /api/models/info?modelKey=... or ?model=... [&brandKey=...]
  async info(req, res) {
    const { modelKey, model, brandKey } = req.query;
    if (!modelKey && !model) {
      throw new AppError(400, 'modelKey or model parameter is required');
    }

    const params = [];
    let where = '';
    if (modelKey) {
      params.push(modelKey);
      where = `pm.model_key = lower(btrim($${params.length}))`;
    } else {
      params.push(model);
      where = `pm.canonical_name ILIKE $${params.length}`;
    }
    if (brandKey) {
      params.push(brandKey);
      where += ` AND b.brand_key = lower(btrim($${params.length}))`;
    }

    let rows;
    try {
      rows = await ProductModel.executeQuery(
        `
        SELECT 
          pm.id,
          pm.canonical_name,
          pm.model_key,
          pm.specs,
          b.canonical_name AS brand_name,
          COALESCE(
            json_agg(json_build_object('url', mi.url, 'is_primary', mi.is_primary, 'sort_order', mi.sort_order)
                     ORDER BY mi.is_primary DESC, mi.sort_order ASC)
            FILTER (WHERE mi.id IS NOT NULL),
            '[]'::json
          ) AS images
        FROM product_models pm
        JOIN brands b ON b.id = pm.brand_id
        LEFT JOIN model_images mi ON mi.model_id = pm.id
        WHERE ${where}
        GROUP BY pm.id, b.canonical_name
        LIMIT 1
        `,
        params
      );
    } catch {
      rows = await ProductModel.executeQuery(
        `
        SELECT 
          pm.id,
          pm.canonical_name,
          pm.model_key,
          pm.specs,
          b.canonical_name AS brand_name,
          '[]'::json AS images
        FROM product_models pm
        JOIN brands b ON b.id = pm.brand_id
        WHERE ${where}
        LIMIT 1
        `,
        params
      );
    }

    return ResponseFormatter.success(res, rows?.[0] || null);
  }
};

export default ModelController;
