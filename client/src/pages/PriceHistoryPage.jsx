import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Scatter, Bar, Legend, ReferenceLine, Area } from 'recharts';
import { format, parseISO, subDays, startOfWeek, addWeeks, subWeeks } from 'date-fns';
import { api } from '../utils/api';
// Time range options
const TIME_RANGES = {
  WEEK: { label: 'Last 7 days', days: 7 },
  MONTH: { label: 'Last 30 days', days: 30 },
  THREE_MONTHS: { label: 'Last 3 months', days: 90 },
  ALL: { label: 'All time', days: null }
};

const PATIENCE_EMA_WINDOW = 7;
const IMAGE_PLACEHOLDER = 'https://upload.wikimedia.org/wikipedia/commons/6/65/No-Image-Placeholder.svg';
const CHART_MIN_START_TS = Date.parse('2025-08-20T00:00:00Z');
const MAX_CHART_POINTS = 1500;
const MAX_PATIENCE_SCATTER_POINTS = 800;

const downsampleByStride = (points, maxPoints) => {
  if (!Array.isArray(points) || points.length <= maxPoints) return points;
  const step = (points.length - 1) / (maxPoints - 1);
  const sampled = [];
  for (let i = 0; i < maxPoints; i += 1) {
    const idx = Math.round(i * step);
    sampled.push(points[idx]);
  }
  return sampled;
};

const percentile = (values, p) => {
  if (values.length === 0) return 0;
  const index = (values.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return values[lower];
  return values[lower] + (values[upper] - values[lower]) * (index - lower);
};

const removeOutliers = (points) => {
  if (points.length < 8) return points;
  const sorted = points.map(p => p.price).sort((a, b) => a - b);
  const q1 = percentile(sorted, 0.25);
  const q3 = percentile(sorted, 0.75);
  const iqr = q3 - q1;
  if (iqr === 0) return points;
  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;
  return points.filter(p => p.price >= lower && p.price <= upper);
};

const weightedPercentile = (entries, p) => {
  if (!Array.isArray(entries) || entries.length === 0) return null;
  const sortedEntries = entries
    .map(({ value, weight }) => ({
      value: Number(value),
      weight: Number.isFinite(Number(weight)) && Number(weight) > 0 ? Number(weight) : 1
    }))
    .filter(({ value }) => Number.isFinite(value))
    .sort((a, b) => a.value - b.value);

  if (sortedEntries.length === 0) return null;

  const totalWeight = sortedEntries.reduce((sum, entry) => sum + entry.weight, 0);
  const threshold = totalWeight * p;
  let runningWeight = 0;

  for (const entry of sortedEntries) {
    runningWeight += entry.weight;
    if (runningWeight >= threshold) {
      return entry.value;
    }
  }

  return sortedEntries[sortedEntries.length - 1].value;
};

const fitLogTrend = (points) => {
  if (!Array.isArray(points) || points.length < 2) return null;

  const minTimestamp = Math.min(...points.map((point) => point.timestamp));
  let sumW = 0;
  let sumX = 0;
  let sumY = 0;
  let sumXX = 0;
  let sumXY = 0;

  for (const point of points) {
    const price = Number(point.median_price);
    if (!Number.isFinite(price) || price <= 0) continue;

    const x = (point.timestamp - minTimestamp) / (1000 * 60 * 60 * 24);
    const y = Math.log(price);
    const weight = Number.isFinite(Number(point.listing_count)) && Number(point.listing_count) > 0
      ? Number(point.listing_count)
      : 1;

    sumW += weight;
    sumX += weight * x;
    sumY += weight * y;
    sumXX += weight * x * x;
    sumXY += weight * x * y;
  }

  const denominator = sumW * sumXX - sumX * sumX;
  if (sumW <= 0 || denominator === 0) return null;

  const slope = (sumW * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / sumW;
  if (!Number.isFinite(slope) || !Number.isFinite(intercept)) return null;

  return { intercept, slope, minTimestamp };
};

export const PriceHistoryPage = () => {
  const { model } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const categoryId = searchParams.get('categoryId');
  const brand = searchParams.get('brand');
  const isKey = searchParams.get('isKey') === '1';
  
  const [priceData, setPriceData] = useState([]);
  const [rawPriceData, setRawPriceData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('ALL');
  const [backendPatienceSeries, setBackendPatienceSeries] = useState([]);
  const [categoryName, setCategoryName] = useState('');
  const [modelImageUrl, setModelImageUrl] = useState(null);
  const [conditionFilter, setConditionFilter] = useState('');
  const [productInfo, setProductInfo] = useState(null);
  const [targetDays, setTargetDays] = useState(7);
  const [selectedPricePoint, setSelectedPricePoint] = useState(null);
  const [selectedPatiencePoint, setSelectedPatiencePoint] = useState(null);

  const priceTrendStats = useMemo(() => {
    if (!Array.isArray(priceData) || priceData.length < 2) return null;
    const first = priceData[0];
    const last = priceData[priceData.length - 1];
    if (!Number.isFinite(first?.trend_price) || !Number.isFinite(last?.trend_price) || first.timestamp === last.timestamp) {
      return null;
    }
    if (first.trend_price <= 0) return null;

    const totalChangePct = ((last.trend_price - first.trend_price) / first.trend_price) * 100;
    return {
      totalChangePct: Math.round(totalChangePct * 10) / 10,
      fittedCurrentPrice: Math.round(last.trend_price)
    };
  }, [priceData]);

  const availableAttributes = useMemo(() => {
    if (!Array.isArray(rawPriceData) || rawPriceData.length === 0) return {};
  
    // Map attributeName -> Set of values
    const attrToValues = new Map();
  
    for (const item of rawPriceData) {
      const attrs = item?.attributes;
      if (!attrs || typeof attrs !== 'object') continue;
  
      for (const [rawKey, rawVal] of Object.entries(attrs)) {

        if (!rawKey || !rawVal) continue;
  
        if (!attrToValues.has(rawKey)) attrToValues.set(rawKey, new Set());
        attrToValues.get(rawKey).add(rawVal);
      }
    }
  
    // Convert Sets to sorted arrays; drop single-value attributes
    const result = {};
    for (const [key, setVals] of attrToValues.entries()) {
      const values = Array.from(setVals).sort((a, b) => a.localeCompare(b));
      if (values.length > 1) result[key] = values;
    }
    return result;
  }, [rawPriceData]);
  // Minimal: no attribute tables or stats

  const fetchModelImage = useCallback(async () => {
    if (!model) return;
    try {
      const params = new URLSearchParams({ model });
      if (categoryId) {
        params.append('categoryId', categoryId);
      }

      const response = await api.get(`/models/image?${params}`);
      if (response.data.success) {
        setModelImageUrl(response.data?.data?.url || null);
      }
    } catch (err) {
      console.error('Error fetching model image:', err);
    }
  }, [model, categoryId]);
  useEffect(() => {
    fetchModelImage();
  }, [fetchModelImage]);

  const fetchProductInfo = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (isKey) params.append('modelKey', model);
      else params.append('model', model);
      const response = await api.get(`/models/info?${params}`);
      if (response.data.success) setProductInfo(response.data.data || null);
    } catch (err) {
      // non-fatal
    }
  }, [model, isKey]);

  useEffect(() => {
    fetchProductInfo();
  }, [fetchProductInfo]);

  const fetchPriceHistory = useCallback(async () => {
    if (!model) {
      setError('Model parameter is required');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      if (isKey) {
        params.append('modelKey', model);
      } else {
        params.append('model', model);
      }
      if (categoryId) {
        params.append('categoryId', categoryId);
      }
      if (brand) {
        params.append('brand', brand);
      }
      params.append('startDate', '2025-08-20T00:00:00Z');
      params.append('maxPoints', '5000');
      
      const response = await api.get(`/models/prices?${params}`);
      const payload = response?.data?.data;
      if (response.data.success && payload) {
        if (Array.isArray(payload)) {
          setRawPriceData(payload);
          setBackendPatienceSeries([]);
        } else if (Array.isArray(payload.series)) {
          setRawPriceData(payload.series);
          setBackendPatienceSeries(
            Array.isArray(payload.patience_0_14) ? payload.patience_0_14 : []
          );
        } else if (Array.isArray(payload.bins)) {
          setRawPriceData(payload.bins);
          setBackendPatienceSeries([]);
        } else {
          setRawPriceData([]);
          setBackendPatienceSeries([]);
          setError('Price data format is invalid');
          return;
        }
      } else {
        setError('No price data available for this model');
      }
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [model, categoryId, isKey, brand]);

  const fetchCategoryName = useCallback(async () => {
    if (!categoryId) return;
    
    try {
      const response = await api.get(`/categories/${categoryId}`);
      if (response.data.success) {
        setCategoryName(response.data.data.name);
      }
    } catch (err) {
      console.error('Error fetching category name:', err);
    }
  }, [categoryId]);

  const conditionOptions = useMemo(() => {
    if (!availableAttributes) return [];
    const opts = availableAttributes['Condition'] || availableAttributes['condition'] || [];
    return Array.isArray(opts) ? opts : [];
  }, [availableAttributes]);

  const filteredRaw = useMemo(() => {
    if (!conditionFilter) return rawPriceData;
    return rawPriceData.filter(item => {
      const attrs = item?.attributes || {};
      const v = attrs['Condition'] || attrs['condition'];
      return v === conditionFilter;
    });
  }, [rawPriceData, conditionFilter]);

  // Effect for fetching data from API (only runs when model/category/brand changes)
  useEffect(() => {
    fetchPriceHistory();
  }, [fetchPriceHistory]);

  useEffect(() => {
    fetchCategoryName();
  }, [fetchCategoryName]);

	  const soldListings = useMemo(() => {
	    if (!filteredRaw || filteredRaw.length === 0) return [];
	    const results = [];
	    for (const item of filteredRaw) {
      if (!item || !item.is_sold || !item.sold_time || !item.post_time) continue;
      let postedAt;
      let soldAt;
      try {
        postedAt = parseISO(item.post_time);
        soldAt = parseISO(item.sold_time);
      } catch {
        continue;
      }
      if (!postedAt || !soldAt || isNaN(+postedAt) || isNaN(+soldAt)) continue;
      const diffDays = (soldAt.getTime() - postedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays < 0) continue;
      const price = parseFloat(item.ema_price ?? item.ema ?? item.price ?? item.price_numeric);
      if (!Number.isFinite(price)) continue;
      results.push({
        days: diffDays,
        daysToSell: diffDays,
        price,
        listing_id: item.listing_id,
        soldAt
      });
	    }
	    return results;
	  }, [filteredRaw]);

	  const patienceRange = useMemo(() => {
      if (backendPatienceSeries.length > 0) {
        const maxBackendDay = backendPatienceSeries.reduce((maxDay, row) => {
          const day = Number(row?.day);
          return Number.isFinite(day) ? Math.max(maxDay, day) : maxDay;
        }, 14);
        return { maxDays: Math.max(1, maxBackendDay) };
      }
	    return { maxDays: 40 };
	  }, [backendPatienceSeries]);

	  useEffect(() => {
	    setTargetDays((current) => Math.min(current, patienceRange.maxDays));
	  }, [patienceRange.maxDays]);

	  const soldListingsForPatienceChart = useMemo(() => {
      if (backendPatienceSeries.length > 0) return [];
	    const inRange = soldListings.filter(
	      (point) => point.daysToSell >= 0 && point.daysToSell <= patienceRange.maxDays
	    );
	    return removeOutliers(inRange);
	  }, [backendPatienceSeries, soldListings, patienceRange.maxDays]);

	  const patienceScatterPoints = useMemo(() => {
      if (backendPatienceSeries.length > 0) return [];
	    if (soldListingsForPatienceChart.length <= MAX_PATIENCE_SCATTER_POINTS) {
	      return soldListingsForPatienceChart;
	    }
	    const sortedByDays = [...soldListingsForPatienceChart].sort((a, b) => a.daysToSell - b.daysToSell);
	    return downsampleByStride(sortedByDays, MAX_PATIENCE_SCATTER_POINTS);
	  }, [backendPatienceSeries, soldListingsForPatienceChart]);

	  const patienceModel = useMemo(() => {
      if (backendPatienceSeries.length > 0) return null;
	    if (soldListingsForPatienceChart.length < 5) return null;
	    let sumX = 0;
	    let sumY = 0;
	    let sumXX = 0;
	    let sumXY = 0;
	    let n = 0;
	    for (const point of soldListingsForPatienceChart) {
	      if (point.price <= 0) continue;
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
    if (n < 2 || denominator === 0) return null;
    const b = (n * sumXY - sumX * sumY) / denominator;
    const a = Math.exp((sumY - b * sumX) / n);
	    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
	    return { a, b };
	  }, [backendPatienceSeries, soldListingsForPatienceChart]);

  const priceForDays = useCallback(
    (days) => {
      if (!patienceModel) return null;
      const estimate = patienceModel.a * Math.exp(patienceModel.b * days);
      if (!Number.isFinite(estimate)) return null;
      return Math.max(0, Math.round(estimate));
    },
    [patienceModel]
  );

		  const patienceCurve = useMemo(() => {
        if (backendPatienceSeries.length > 0) return [];
		    if (!patienceModel || soldListingsForPatienceChart.length === 0) return [];
		    const points = [];
		    for (let day = 0; day <= patienceRange.maxDays; day += 1) {
		      const price = priceForDays(day);
		      if (price === null) continue;
		      points.push({ days: day, predicted: price });
		    }
		    return points;
		  }, [backendPatienceSeries, patienceModel, soldListingsForPatienceChart.length, patienceRange.maxDays, priceForDays]);

	  const patienceEmaCurve = useMemo(() => {
      if (backendPatienceSeries.length > 0) return [];
	    if (soldListingsForPatienceChart.length < 3) return [];

	    const pricesByDay = new Map();
	    for (const point of soldListingsForPatienceChart) {
	      const day = Math.round(point.daysToSell);
	      if (day < 0 || day > patienceRange.maxDays) continue;
	      if (!pricesByDay.has(day)) pricesByDay.set(day, []);
	      pricesByDay.get(day).push(point.price);
	    }

	    const dailyAvg = new Map();
	    for (const [day, prices] of pricesByDay.entries()) {
	      if (!prices.length) continue;
	      dailyAvg.set(day, prices.reduce((sum, value) => sum + value, 0) / prices.length);
	    }

	    const smoothing = 2 / (PATIENCE_EMA_WINDOW + 1);
	    let ema = null;
	    const series = [];

	    for (let day = 0; day <= patienceRange.maxDays; day += 1) {
	      const value = dailyAvg.get(day);
	      if (value === undefined) {
	        if (ema !== null) {
	          series.push({ days: day, patienceEma: +ema.toFixed(2) });
	        }
	        continue;
	      }

	      ema = ema === null ? value : value * smoothing + ema * (1 - smoothing);
	      series.push({ days: day, patienceEma: +ema.toFixed(2) });
	    }

	    return series;
	  }, [backendPatienceSeries, soldListingsForPatienceChart, patienceRange.maxDays]);

	  const patienceChartSeries = useMemo(() => {
      if (backendPatienceSeries.length > 0) {
        return backendPatienceSeries
          .map((row) => {
            const day = Number(row?.day);
            if (!Number.isFinite(day)) return null;
            const predicted = Number(row?.predicted_price);
            const patienceEma = Number(row?.ema_price);
            const soldCount = Number(row?.sold_count);
            return {
              days: day,
              predicted: Number.isFinite(predicted) ? predicted : null,
              patienceEma: Number.isFinite(patienceEma) ? patienceEma : null,
              soldCount: Number.isFinite(soldCount) ? soldCount : 0,
            };
          })
          .filter(Boolean)
          .sort((a, b) => a.days - b.days);
      }

	    const predictedByDay = new Map(patienceCurve.map((point) => [point.days, point.predicted]));
	    const emaByDay = new Map(patienceEmaCurve.map((point) => [point.days, point.patienceEma]));
	    const series = [];

	    for (let day = 0; day <= patienceRange.maxDays; day += 1) {
	      series.push({
	        days: day,
	        predicted: predictedByDay.get(day) ?? null,
	        patienceEma: emaByDay.get(day) ?? null,
	      });
	    }

	    return series;
	  }, [backendPatienceSeries, patienceCurve, patienceEmaCurve, patienceRange.maxDays]);

    const getPatienceSeriesPrice = useCallback((days) => {
      const match = patienceChartSeries.find((row) => row.days === days);
      if (!match) return null;
      if (Number.isFinite(match.predicted)) return Math.round(match.predicted);
      if (Number.isFinite(match.patienceEma)) return Math.round(match.patienceEma);
      return null;
    }, [patienceChartSeries]);

	  const recommendedPrice = useMemo(() => {
      if (backendPatienceSeries.length > 0) {
        return getPatienceSeriesPrice(targetDays);
      }
	    if (!patienceModel) return null;
	    return priceForDays(targetDays);
	  }, [backendPatienceSeries, getPatienceSeriesPrice, patienceModel, priceForDays, targetDays]);

  const tradeoffInsight = useMemo(() => {
    if (!recommendedPrice) return null;
    const deltaDays = backendPatienceSeries.length > 0 ? 7 : 14;
    const targetLaterDay = Math.min(targetDays + deltaDays, patienceRange.maxDays);
    if (targetLaterDay <= targetDays) return null;
    const laterPrice = backendPatienceSeries.length > 0
      ? getPatienceSeriesPrice(targetLaterDay)
      : priceForDays(targetLaterDay);
    if (!laterPrice) return null;
    return { laterPrice, delta: laterPrice - recommendedPrice, deltaDays: targetLaterDay - targetDays };
  }, [backendPatienceSeries, getPatienceSeriesPrice, patienceRange.maxDays, recommendedPrice, targetDays, priceForDays]);

	  const velocitySeries = useMemo(() => {
    if (soldListings.length === 0) return [];
    const weeks = 12;
    const endWeek = startOfWeek(new Date(), { weekStartsOn: 1 });
    const series = [];
    for (let i = weeks - 1; i >= 0; i -= 1) {
      const start = subWeeks(endWeek, i);
      const end = addWeeks(start, 1);
      const inWeek = soldListings.filter(point => point.soldAt >= start && point.soldAt < end);
      const soldCount = inWeek.length;
      const avgDays = soldCount
        ? inWeek.reduce((sum, point) => sum + point.daysToSell, 0) / soldCount
        : null;
      series.push({
        weekStart: start.getTime(),
        weekLabel: format(start, 'MMM d'),
        soldCount,
        avgDays: avgDays !== null ? Math.round(avgDays) : null
      });
    }
    return series;
	  }, [soldListings]);

	  const handlePriceChartClick = useCallback((chartState) => {
	    const point = chartState?.activePayload?.[0]?.payload;
	    if (!point || typeof point.date !== 'string' || !Number.isFinite(point.price)) {
	      return;
	    }
	    setSelectedPricePoint((current) => {
	      if (current && current.date === point.date) return null;
	      return { date: point.date, price: point.price };
	    });
	  }, []);

		  const handlePatienceChartClick = useCallback((chartState) => {
		    const payloads = chartState?.activePayload || [];
		    const base = payloads[0]?.payload;
		    const days = base?.days;
		    if (typeof days !== 'number' || !Number.isFinite(days)) return;

		    const pick = (key) =>
		      payloads.find((entry) => entry?.dataKey === key && Number.isFinite(entry.value))?.value ?? null;

		    let price = pick('price');
		    if (price === null) price = pick('patienceEma');
		    if (price === null && Number.isFinite(base?.patienceEma)) price = base.patienceEma;
		    if (price === null && Number.isFinite(base?.price)) price = base.price;
		    if (price === null) return;

	    setSelectedPatiencePoint((current) => {
	      if (current && current.days === days) return null;
	      return { days, price };
	    });
	  }, []);

  const processData = useCallback((data) => {
    let listingSeries = data.map(item => {
      const rawPrice = Number(item.price ?? item.price_numeric ?? item.ema_price ?? item.ema);
      if (!Number.isFinite(rawPrice) || rawPrice <= 0) return null;

      const timeValue = item.post_time || item.day || item.day_bin;
      if (!timeValue) return null;
      const normalizedTimeValue =
        typeof timeValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(timeValue)
          ? `${timeValue}T00:00:00Z`
          : timeValue;
      const postDate =
        typeof normalizedTimeValue === 'string'
          ? parseISO(normalizedTimeValue)
          : new Date(normalizedTimeValue);
      if (Number.isNaN(postDate.getTime())) return null;

      const listingCountRaw = Number(item.listing_count);
      const soldCountRaw = Number(item.sold_count);
      const listingCount = Number.isFinite(listingCountRaw) ? listingCountRaw : 1;
      const soldCount = Number.isFinite(soldCountRaw) ? soldCountRaw : 0;

      return {
        dayKey: format(postDate, 'yyyy-MM-dd'),
        timestamp: postDate.getTime(),
        price: +rawPrice.toFixed(2),
        listing_count: listingCount,
        sold_count: soldCount,
      };
    }).filter(Boolean);

    listingSeries.sort((a, b) => a.timestamp - b.timestamp);
    listingSeries = listingSeries.filter(item => item.timestamp >= CHART_MIN_START_TS);

    if (TIME_RANGES[timeRange] && TIME_RANGES[timeRange].days) {
      const cutoffDate = subDays(new Date(), TIME_RANGES[timeRange].days).getTime();
      listingSeries = listingSeries.filter(item => item.timestamp >= cutoffDate);
    }

    listingSeries = removeOutliers(listingSeries);

    const groupedByDay = new Map();
    for (const point of listingSeries) {
      if (!groupedByDay.has(point.dayKey)) groupedByDay.set(point.dayKey, []);
      groupedByDay.get(point.dayKey).push(point);
    }

    let chartData = Array.from(groupedByDay.entries()).map(([dayKey, points]) => {
      const weightedPrices = points.map((point) => ({
        value: point.price,
        weight: point.listing_count
      }));
      const q1 = weightedPercentile(weightedPrices, 0.25);
      const median = weightedPercentile(weightedPrices, 0.5);
      const q3 = weightedPercentile(weightedPrices, 0.75);
      const minPrice = Math.min(...points.map((point) => point.price));
      const maxPrice = Math.max(...points.map((point) => point.price));
      const listingCount = points.reduce((sum, point) => sum + point.listing_count, 0);
      const soldCount = points.reduce((sum, point) => sum + point.sold_count, 0);
      const dayDate = parseISO(`${dayKey}T00:00:00Z`);

      return {
        date: dayKey,
        timestamp: dayDate.getTime(),
        post_time: dayDate.toISOString(),
        listing_count: listingCount,
        sold_count: soldCount,
        min_price: Number.isFinite(minPrice) ? +minPrice.toFixed(2) : null,
        max_price: Number.isFinite(maxPrice) ? +maxPrice.toFixed(2) : null,
        q1_price: Number.isFinite(q1) ? +q1.toFixed(2) : null,
        median_price: Number.isFinite(median) ? +median.toFixed(2) : null,
        q3_price: Number.isFinite(q3) ? +q3.toFixed(2) : null,
        iqr_band: Number.isFinite(q1) && Number.isFinite(q3) ? +(q3 - q1).toFixed(2) : null,
        price: Number.isFinite(median) ? +median.toFixed(2) : null
      };
    }).filter((point) => Number.isFinite(point.median_price));

    chartData.sort((a, b) => a.timestamp - b.timestamp);

    const trendModel = fitLogTrend(chartData);
    if (trendModel) {
      chartData = chartData.map((point) => {
        const x = (point.timestamp - trendModel.minTimestamp) / (1000 * 60 * 60 * 24);
        const trendPrice = Math.exp(trendModel.intercept + trendModel.slope * x);
        return {
          ...point,
          trend_price: Number.isFinite(trendPrice) ? +trendPrice.toFixed(2) : null
        };
      });
    }

    chartData = downsampleByStride(chartData, MAX_CHART_POINTS);

    setPriceData(chartData);
  }, [timeRange]);

  // Effect for processing raw data (runs when rawPriceData or timeRange change)
  useEffect(() => {
    if (filteredRaw.length === 0) {
      setPriceData([]);
      return;
    }

    processData(filteredRaw);
  }, [filteredRaw, processData]);

  const averagePrice = useMemo(() => {
    if (!filteredRaw || filteredRaw.length === 0) return null;
    let weightedSum = 0;
    let totalWeight = 0;
    for (const item of filteredRaw) {
      const price = parseFloat(item.price ?? item.price_numeric ?? item.ema_price ?? item.ema);
      if (!Number.isFinite(price)) continue;
      const candidateWeight = Number(item.listing_count);
      const weight = Number.isFinite(candidateWeight) && candidateWeight > 0 ? candidateWeight : 1;
      weightedSum += price * weight;
      totalWeight += weight;
    }
    if (totalWeight === 0) return null;
    return Math.round(weightedSum / totalWeight);
  }, [filteredRaw]);

  const totalListingsRepresented = useMemo(() => {
    if (!filteredRaw || filteredRaw.length === 0) return 0;
    return filteredRaw.reduce((sum, item) => {
      const candidate = Number(item.listing_count);
      if (Number.isFinite(candidate) && candidate > 0) {
        return sum + candidate;
      }
      return sum + 1;
    }, 0);
  }, [filteredRaw]);

  const sellThroughRates = useMemo(() => {
    if (!filteredRaw || filteredRaw.length === 0) return null;
    const hasSoldTimestamps = filteredRaw.some(
      (item) => item?.is_sold && item?.sold_time && item?.post_time
    );
    if (!hasSoldTimestamps) return null;
    let totalSold = 0;
    let le24h = 0;
    let le3d = 0;
    let le7d = 0;
    for (const item of filteredRaw) {
      if (!item || !item.is_sold || !item.sold_time || !item.post_time) continue;
      let postedAt, soldAt;
      try {
        postedAt = parseISO(item.post_time);
        soldAt = parseISO(item.sold_time);
      } catch {
        continue;
      }
      if (!postedAt || !soldAt || isNaN(+postedAt) || isNaN(+soldAt)) continue;
      const diffHours = (soldAt.getTime() - postedAt.getTime()) / (1000 * 60 * 60);
      if (diffHours < 0) continue;
      totalSold += 1;
      if (diffHours <= 24) le24h += 1;
      if (diffHours <= 72) le3d += 1;
      if (diffHours <= 168) le7d += 1;
    }
    if (totalSold === 0) return { le24hPct: null, le3dPct: null, le7dPct: null, totalSold: 0 };
    const pct = (n) => Math.round((n / totalSold) * 100);
    return {
      le24hPct: pct(le24h),
      le3dPct: pct(le3d),
      le7dPct: pct(le7d),
      totalSold,
    };
  }, [filteredRaw]);

  const timeToSellStats = useMemo(() => {
    if (!filteredRaw || filteredRaw.length === 0) return null;
    const hasSoldTimestamps = filteredRaw.some(
      (item) => item?.is_sold && item?.sold_time && item?.post_time
    );
    if (!hasSoldTimestamps) return null;
    const daysToSell = [];
    for (const item of filteredRaw) {
      if (!item || !item.is_sold || !item.sold_time || !item.post_time) continue;
      let postedAt, soldAt;
      try {
        postedAt = parseISO(item.post_time);
        soldAt = parseISO(item.sold_time);
      } catch {
        continue;
      }
      if (!postedAt || !soldAt || isNaN(+postedAt) || isNaN(+soldAt)) continue;
      const diffDays = (soldAt.getTime() - postedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays >= 0) daysToSell.push(diffDays);
    }
    if (daysToSell.length === 0) return { medianDays: null, p75Days: null };
    daysToSell.sort((a, b) => a - b);
    const n = daysToSell.length;
    const median = n % 2 === 1 ? daysToSell[(n - 1) / 2] : (daysToSell[n / 2 - 1] + daysToSell[n / 2]) / 2;
    const p75Index = Math.ceil(0.75 * n) - 1;
    const p75 = daysToSell[Math.max(0, p75Index)];
    return { medianDays: Math.round(median), p75Days: Math.round(p75) };
  }, [filteredRaw]);

  const sellingSpeedStats = useMemo(() => {
    if (!filteredRaw || filteredRaw.length === 0) return null;
    const hasSoldTimestamps = filteredRaw.some(
      (item) => item?.is_sold && item?.sold_time && item?.post_time
    );
    if (!hasSoldTimestamps) return null;
    const buckets = {
      lt24h: [],
      lt3d: [],
      lt5d: [],
      lt7d: [],
      ge7d: [],
    };
    for (const item of filteredRaw) {
      if (!item || !item.is_sold || !item.sold_time || !item.post_time) continue;
      const price = parseFloat(item.ema_price ?? item.ema ?? item.price ?? item.price_numeric);
      if (Number.isNaN(price)) continue;
      let postedAt, soldAt;
      try {
        postedAt = parseISO(item.post_time);
        soldAt = parseISO(item.sold_time);
      } catch {
        continue;
      }
      if (!postedAt || !soldAt || isNaN(+postedAt) || isNaN(+soldAt)) continue;
      const diffHours = (soldAt.getTime() - postedAt.getTime()) / (1000 * 60 * 60);
      if (diffHours < 0) continue;
      if (diffHours < 24) buckets.lt24h.push(price);
      else if (diffHours < 72) buckets.lt3d.push(price);
      else if (diffHours < 120) buckets.lt5d.push(price);
      else if (diffHours < 168) buckets.lt7d.push(price);
      else buckets.ge7d.push(price);
    }
    const summarize = (arr) => ({
      avg: arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null,
      count: arr.length,
    });
    return {
      lt24h: summarize(buckets.lt24h),
      lt3d: summarize(buckets.lt3d),
      lt5d: summarize(buckets.lt5d),
      lt7d: summarize(buckets.lt7d),
      ge7d: summarize(buckets.ge7d),
    };
  }, [filteredRaw]);

  const formatCurrency = useMemo(() => new Intl.NumberFormat('fi-FI', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }), []);

  const formatXAxisTick = (value) => {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return format(parseISO(`${value}T00:00:00Z`), 'MMM d');
    }
    if (typeof value === 'number') {
      return format(new Date(value), 'MMM d');
    }
    return String(value);
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const timestamp = data.post_time ? parseISO(data.post_time) : new Date(data.timestamp);
      const listingCount = Number(data.listing_count);
      const soldCount = Number(data.sold_count);
      const minPrice = Number(data.min_price);
      const maxPrice = Number(data.max_price);
      const medianPrice = Number(data.median_price);
      const trendPrice = Number(data.trend_price);
      const q1Price = Number(data.q1_price);
      const q3Price = Number(data.q3_price);
      return (
        <div className="custom-tooltip">
          <p className="label">{format(timestamp, 'MMM d, yyyy')}</p>
          {Number.isFinite(listingCount) && (
            <p style={{ fontSize: '12px', color: '#007bff', fontWeight: 'bold' }}>
              Listings: {listingCount}
            </p>
          )}
          {Number.isFinite(medianPrice) && (
            <p style={{ color: '#1459c7' }}>
              Daily median: €{Math.round(medianPrice)}
            </p>
          )}
          {Number.isFinite(trendPrice) && (
            <p style={{ color: '#ef4444' }}>
              Fitted trend: €{Math.round(trendPrice)}
            </p>
          )}
          {Number.isFinite(q1Price) && Number.isFinite(q3Price) && (
            <p style={{ fontSize: '12px', color: '#666' }}>
              Mid 50%: €{Math.round(q1Price)} - €{Math.round(q3Price)}
            </p>
          )}
          {Number.isFinite(minPrice) && Number.isFinite(maxPrice) && (
            <p style={{ fontSize: '12px', color: '#666' }}>
              Full range: €{Math.round(minPrice)} - €{Math.round(maxPrice)}
            </p>
          )}
          {Number.isFinite(soldCount) && (
            <p style={{ fontSize: '12px', color: '#666' }}>
              Sold: {soldCount}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

	  const PatienceTooltip = ({ active, payload }) => {
	    if (!active || !payload || payload.length === 0) return null;

	    const anyPayload = payload.find((entry) => entry?.payload);
	    const daysFromPayload = Number.isFinite(anyPayload?.payload?.days) ? anyPayload.payload.days : null;
	    const daysFromDaysToSell = Number.isFinite(anyPayload?.payload?.daysToSell) ? anyPayload.payload.daysToSell : null;
	    const rawDays = daysFromPayload ?? daysFromDaysToSell;
	    if (!Number.isFinite(rawDays)) return null;
	    const days = Math.round(rawDays);

	    const salePrice = payload.find((entry) => entry?.dataKey === 'price' && Number.isFinite(entry.value))?.value;
	    const predicted = payload.find((entry) => entry?.dataKey === 'predicted' && Number.isFinite(entry.value))?.value;
	    const ema = payload.find((entry) => entry?.dataKey === 'patienceEma' && Number.isFinite(entry.value))?.value;

	    return (
	      <div className="custom-tooltip">
	        <p className="label">{days} days</p>
	        {Number.isFinite(salePrice) && <p style={{ color: '#7c3aed' }}>Sale: €{Math.round(salePrice)}</p>}
	        {Number.isFinite(ema) && <p style={{ color: 'rgba(239, 68, 68, 0.85)' }}>EMA: €{Math.round(ema)}</p>}
	        {Number.isFinite(predicted) && (
	          <p style={{ color: 'rgba(59, 130, 246, 0.8)' }}>Trend: €{Math.round(predicted)}</p>
	        )}
	      </div>
	    );
	  };

  const VelocityTooltip = ({ active, payload }) => {
    if (!active || !payload || payload.length === 0) return null;
    const data = payload[0].payload;
    if (!data) return null;
    return (
      <div className="custom-tooltip">
        <p className="label">{data.weekLabel}</p>
        <p style={{ color: '#2563eb' }}>Sales: {data.soldCount}</p>
        <p style={{ color: '#16a34a' }}>
          Avg days to sell: {data.avgDays !== null ? `${data.avgDays}d` : '–'}
        </p>
      </div>
    );
  };

  if (loading) {
    return <div className="app-shell app-loading">Loading price history...</div>;
  }

  if (error) {
    return (
      <div className="app-shell app-error">
        <div className="app-error-box">
          <div className="font-semibold mb-2 text-[var(--landing-text-strong)]">Error</div>
          <div className="app-muted mb-4">{error}</div>
          <button onClick={() => navigate(-1)} className="app-btn">Go Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {/* Header */}
      <div className="app-header">
        <div className="app-container app-header-row">
          <button onClick={() => navigate(-1)} className="app-btn">← Back</button>
          <h1 className="text-2xl font-bold text-[var(--landing-text-strong)]">Price History</h1>
        </div>
      </div>

      {/* Model title */}
      <div className="app-container px-4 py-6">
        <div className="app-panel p-6">
          <h2 className="text-2xl md:text-3xl font-bold text-[var(--landing-text-strong)] mb-6">
            {productInfo?.canonical_name || model}
            {productInfo?.brand_name ? <span className="app-muted text-xl"> • {productInfo.brand_name}</span> : null}
          </h2>

          {/* Image + Average price row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="w-full">
              <div className="w-full h-56 md:h-64 rounded-xl overflow-hidden flex items-center justify-center">
                <img
                  src={modelImageUrl || IMAGE_PLACEHOLDER}
                  alt={`${model} image`}
                  className="w-full h-full object-contain"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={(e) => { if (e.currentTarget.src !== IMAGE_PLACEHOLDER) e.currentTarget.src = IMAGE_PLACEHOLDER; }}
                />
              </div>
              <div className="mt-2 text-sm text-gray-500">
                {brand && <span className="mr-3">Brand: <span className="text-gray-800">{brand}</span></span>}
                {categoryName && <span>Category: <span className="text-gray-800">{categoryName}</span></span>}
              </div>
            </div>

            <div className="w-full">
              <div className="app-panel p-6">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
                  <div>
                    <div className="text-gray-500 text-sm">Average price</div>
                    <div className="text-3xl font-bold text-gray-900 mt-1">{averagePrice !== null ? formatCurrency.format(averagePrice) : '–'}</div>
                    <div className="mt-3 text-sm text-gray-500">{priceData.length} daily bin{priceData.length !== 1 ? 's' : ''}</div>
                    <div className="mt-1 text-sm text-gray-500">
                      Series: daily median + fitted trend • {totalListingsRepresented} listings
                    </div>
                    {priceTrendStats && (
                      <div className="mt-1 text-sm text-gray-600">
                        Fitted current price: {formatCurrency.format(priceTrendStats.fittedCurrentPrice)} • Trend: {priceTrendStats.totalChangePct > 0 ? '+' : ''}{priceTrendStats.totalChangePct}%
                      </div>
                    )}
                    {sellThroughRates && (
                      <div className="mt-3 text-sm text-gray-700">
                        <div className="font-medium text-gray-700">Sell-through</div>
                        <div className="text-gray-600">
                          {`24h: ${sellThroughRates.le24hPct !== null ? sellThroughRates.le24hPct + '%' : '–'}, `}
                          {`3d: ${sellThroughRates.le3dPct !== null ? sellThroughRates.le3dPct + '%' : '–'}, `}
                          {`7d: ${sellThroughRates.le7dPct !== null ? sellThroughRates.le7dPct + '%' : '–'}`}
                        </div>
                      </div>
                    )}
                    {timeToSellStats && (
                      <div className="mt-1 text-sm text-gray-700">
                        <div className="text-gray-600">
                          {`Median time-to-sell: ${timeToSellStats.medianDays !== null ? timeToSellStats.medianDays + 'd' : '–'} `}
                          {`(P75: ${timeToSellStats.p75Days !== null ? timeToSellStats.p75Days + 'd' : '–'})`}
                        </div>
                      </div>
                    )}
                  </div>
                  {sellingSpeedStats && (
                    <div className="text-sm text-gray-600">
                      <div className="font-medium text-gray-700 mb-1">Avg by selling time (count)</div>
                      <div className="space-y-1 md:text-right">
                        <div>
                          <span className="text-gray-500">&lt; 24h:</span> {sellingSpeedStats.lt24h.avg !== null ? formatCurrency.format(sellingSpeedStats.lt24h.avg) : '–'} {`(${sellingSpeedStats.lt24h.count})`}
                        </div>
                        <div>
                          <span className="text-gray-500">&lt; 3d:</span> {sellingSpeedStats.lt3d.avg !== null ? formatCurrency.format(sellingSpeedStats.lt3d.avg) : '–'} {`(${sellingSpeedStats.lt3d.count})`}
                        </div>
                        <div>
                          <span className="text-gray-500">&lt; 5d:</span> {sellingSpeedStats.lt5d.avg !== null ? formatCurrency.format(sellingSpeedStats.lt5d.avg) : '–'} {`(${sellingSpeedStats.lt5d.count})`}
                        </div>
                        <div>
                          <span className="text-gray-500">&lt; 7d:</span> {sellingSpeedStats.lt7d.avg !== null ? formatCurrency.format(sellingSpeedStats.lt7d.avg) : '–'} {`(${sellingSpeedStats.lt7d.count})`}
                        </div>
                        <div>
                          <span className="text-gray-500">≥ 7d:</span> {sellingSpeedStats.ge7d.avg !== null ? formatCurrency.format(sellingSpeedStats.ge7d.avg) : '–'} {`(${sellingSpeedStats.ge7d.count})`}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Time range controls */}
      <div className="app-container px-4">
        <div className="app-panel p-6 mb-6">
          <h3 className="text-lg font-semibold text-[var(--landing-text-strong)] mb-3">Time Range</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(TIME_RANGES).map(([key, range]) => (
              <button
                key={key}
                onClick={() => setTimeRange(key)}
                className={`app-btn ${timeRange === key ? 'app-btn-active' : ''}`}
              >
                {range.label}
              </button>
            ))}
          </div>
          {conditionOptions.length > 0 && (
            <div className="mt-4 flex items-center gap-2">
              <label className="text-sm text-gray-700">Condition:</label>
              <select
                value={conditionFilter}
                onChange={(e) => setConditionFilter(e.target.value)}
                className="app-select"
              >
                <option value="">All</option>
                {conditionOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="app-container px-4 pb-10">
        <section className="app-panel p-6">
	          <ResponsiveContainer width="100%" height={400}>
	            <ComposedChart data={priceData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }} onClick={handlePriceChartClick}>
	              <CartesianGrid stroke="#e5e7eb" strokeDasharray="4 4" />
	              <XAxis 
	                type="category"
	                dataKey="date"
                tickFormatter={formatXAxisTick}
                interval="preserveStartEnd"
                  minTickGap={24}
              />
              <YAxis 
                tickFormatter={(value) => `€${value}`}
                domain={['auto', 'auto']}
                tickCount={5}
              />
	              <Tooltip
	                content={<CustomTooltip />}
	                cursor={{ stroke: '#9ca3af', strokeWidth: 1, strokeDasharray: '4 4' }}
	              />
	              {selectedPricePoint && (
	                <>
	                  <ReferenceLine
	                    x={selectedPricePoint.date}
	                    stroke="#111827"
	                    strokeDasharray="3 3"
	                    strokeWidth={1}
	                  />
	                  <ReferenceLine
	                    y={selectedPricePoint.price}
	                    stroke="#111827"
	                    strokeDasharray="3 3"
	                    strokeWidth={1}
	                  />
	                </>
	              )}
                <Area
                  type="monotone"
                  dataKey="q1_price"
                  stackId="price-band"
                  stroke="none"
                  fill="transparent"
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="iqr_band"
                  stackId="price-band"
                  stroke="none"
                  fill="rgba(20, 89, 199, 0.12)"
                  name="Middle 50%"
                  isAnimationActive={false}
                />
	              <Line 
	                type="monotone" 
	                dataKey="median_price" 
	                stroke="#1459c7" 
	                name="Daily median"
	                strokeWidth={3}
	                dot={false}
	                connectNulls
              />
	              <Line 
	                type="monotone" 
	                dataKey="trend_price" 
	                stroke="#ef4444" 
	                name="Fitted trend"
	                strokeWidth={2}
	                dot={false}
	                connectNulls
                  strokeDasharray="6 4"
              />
              <Legend />
            </ComposedChart>
          </ResponsiveContainer>
          {productInfo?.specs && Object.keys(productInfo.specs).length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Specs</h3>
              <div className="text-sm text-gray-700 grid grid-cols-1 md:grid-cols-2 gap-2">
                {Object.entries(productInfo.specs).map(([k, v]) => (
                  <div key={k} className="flex items-start gap-2">
                    <span className="text-gray-500 min-w-28">{k}</span>
                    <span className="text-gray-800">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Liquidity insights */}
      <div className="app-container px-4 pb-12">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
	          <section className="app-panel p-6">
	            <h3 className="text-lg font-semibold text-[var(--landing-text-strong)] mb-4">Price vs. Patience</h3>
	            {patienceChartSeries.length === 0 ? (
	              <div className="text-sm text-gray-600">Not enough sold listings to estimate the curve yet.</div>
	            ) : (
	              <>
	                {backendPatienceSeries.length === 0 && !patienceModel ? (
	                  <div className="text-sm text-gray-600 mb-4">
	                    Not enough sold listings to estimate the curve yet (need at least 5). Showing sold listings (and EMA if available).
	                  </div>
	                ) : backendPatienceSeries.length > 0 ? (
                    <div className="text-sm text-gray-600 mb-4">
                      Using backend pre-calculated 0-14 day values.
                    </div>
	                ) : (
	                  <>
	                    <div className="mb-4">
	                      <label className="text-sm text-gray-700 block mb-2">
	                        I want to sell within: <span className="font-semibold">{targetDays} days</span>
	                      </label>
	                      <input
	                        type="range"
	                        min={1}
	                        max={patienceRange.maxDays}
	                        value={targetDays}
	                        onChange={(e) => setTargetDays(Number(e.target.value))}
	                        className="w-full accent-blue-600"
	                      />
	                    </div>
	                    <div className="app-panel-soft p-4 mb-4">
	                      <div className="text-sm text-gray-500">Recommended price</div>
	                      <div className="text-2xl font-bold text-[var(--landing-text-strong)]">
	                        {recommendedPrice ? formatCurrency.format(recommendedPrice) : '–'}
	                      </div>
	                      {tradeoffInsight && (
	                        <div className="text-sm text-gray-600 mt-2">
	                          Listing for {formatCurrency.format(tradeoffInsight.laterPrice)} might earn you{' '}
	                          {formatCurrency.format(Math.max(0, tradeoffInsight.delta))}, but typically adds{' '}
	                          {tradeoffInsight.deltaDays} days.
	                        </div>
	                      )}
	                    </div>
	                  </>
	                )}
	                <ResponsiveContainer width="100%" height={280}>
	                  <ComposedChart
	                    data={patienceChartSeries}
	                    margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
	                    onClick={handlePatienceChartClick}
	                  >
	                    <CartesianGrid stroke="#e5e7eb" strokeDasharray="4 4" />
	                    <XAxis type="number" dataKey="days" tickCount={6} domain={[0, patienceRange.maxDays]} />
	                    <YAxis tickFormatter={(value) => `€${value}`} tickCount={5} />
	                    <Tooltip content={<PatienceTooltip />} />
	                    {selectedPatiencePoint && (
	                      <>
	                        <ReferenceLine
	                          x={selectedPatiencePoint.days}
	                          stroke="#111827"
	                          strokeDasharray="3 3"
	                          strokeWidth={1}
	                        />
	                        <ReferenceLine
	                          y={selectedPatiencePoint.price}
	                          stroke="#111827"
	                          strokeDasharray="3 3"
	                          strokeWidth={1}
	                        />
	                      </>
	                    )}
                      {backendPatienceSeries.length === 0 && (
	                        <Scatter
	                          data={patienceScatterPoints}
	                          name="Sales"
	                          fill="rgba(124, 58, 237, 0.35)"
	                          dataKey="price"
	                        />
                      )}
	                    {patienceChartSeries.some((point) => Number.isFinite(point.patienceEma)) && (
	                      <Line
	                        type="monotone"
	                        dataKey="patienceEma"
	                        stroke="rgba(239, 68, 68, 0.6)"
	                        strokeWidth={2}
	                        dot={false}
	                        name="EMA"
	                      />
	                    )}
	                    <Legend />
	                  </ComposedChart>
	                </ResponsiveContainer>
	              </>
            )}
          </section>

          <section className="app-panel p-6">
            <h3 className="text-lg font-semibold text-[var(--landing-text-strong)] mb-4">Market Velocity</h3>
            {velocitySeries.length === 0 ? (
              <div className="text-sm text-gray-600">Not enough sold listings to show velocity yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={velocitySeries} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
	                  <CartesianGrid stroke="#e5e7eb" strokeDasharray="4 4" />
	                  <XAxis
	                    dataKey="weekLabel"
	                    interval={1}
	                    minTickGap={12}
	                  />
	                  <YAxis yAxisId="left" tickCount={4} allowDecimals={false} domain={[0, 'dataMax + 1']} />
	                  <YAxis
	                    yAxisId="right"
	                    orientation="right"
	                    tickCount={4}
	                    allowDecimals={false}
	                    domain={[0, 'dataMax + 1']}
	                    tickFormatter={(value) => `${value}d`}
	                  />
	                  <Tooltip content={<VelocityTooltip />} />
	                  <Bar
	                    yAxisId="left"
                    dataKey="soldCount"
                    name="Sales volume"
                    fill="rgba(59, 130, 246, 0.6)"
                    barSize={12}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="avgDays"
	                    name="Avg days to sell"
	                    stroke="#16a34a"
	                    strokeWidth={2.5}
	                    dot={{ r: 2 }}
	                    connectNulls
	                  />
                  <Legend />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
