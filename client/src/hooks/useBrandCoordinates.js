import { useEffect, useState } from 'react';
import { api } from '../utils/api';

const COORDINATE_FETCH_DEBOUNCE_MS = 250;
const COORDINATE_LIMIT = 2500;
const COORDINATE_MIN_COUNT = 1;
const COORDINATE_START_DATE = '2025-08-20T00:00:00Z';

export function useBrandCoordinates(brandName, categoryId, viewport) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!brandName || !categoryId) return undefined;

    let isMounted = true;
    const controller = new AbortController();

    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const params = {
          categoryId,
          limit: COORDINATE_LIMIT,
          minCount: COORDINATE_MIN_COUNT,
          startDate: COORDINATE_START_DATE
        };
        if (
          viewport &&
          Number.isFinite(viewport.south) &&
          Number.isFinite(viewport.west) &&
          Number.isFinite(viewport.north) &&
          Number.isFinite(viewport.east)
        ) {
          params.south = viewport.south;
          params.west = viewport.west;
          params.north = viewport.north;
          params.east = viewport.east;
        }

        const res = await api.get(`/brands/${encodeURIComponent(brandName)}/coordinates`, {
          params,
          signal: controller.signal
        });
        if (!isMounted) return;
        const rawBins = Array.isArray(res.data?.data?.bins) ? res.data.data.bins : [];
        const bins = rawBins
          .map((bin) => ({
            day: typeof bin.day === 'string' ? bin.day : String(bin.day || ''),
            postal_region: typeof bin.postal_region === 'string' ? bin.postal_region : null,
            listing_count: Number.isFinite(bin.listing_count) ? bin.listing_count : parseInt(bin.listing_count, 10),
            avg_price:
              bin.avg_price === null || bin.avg_price === undefined
                ? null
                : (Number.isFinite(bin.avg_price) ? bin.avg_price : parseFloat(bin.avg_price)),
          }))
          .filter((bin) => bin.postal_region && Number.isFinite(bin.listing_count) && bin.listing_count > 0);
        setData(bins);
      } catch (e) {
        if (!isMounted) return;
        if (e?.name === 'CanceledError' || e?.name === 'AbortError') return;
        setError(e.message || 'Failed to fetch coordinates');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }, COORDINATE_FETCH_DEBOUNCE_MS);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      controller.abort();
    }
  }, [brandName, categoryId, viewport?.south, viewport?.west, viewport?.north, viewport?.east]);

  return { data, loading, error };
}
