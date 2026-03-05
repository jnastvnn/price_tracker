import { useEffect, useState } from 'react';
import { api } from '../utils/api';

export function useBrandAnalytics(brandName, categoryId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function fetchAnalytics() {
      if (!brandName || !categoryId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await api.get(`/brands/${encodeURIComponent(brandName)}/analytics`, {
          params: { categoryId }
        });
        if (!isMounted) return;
        setData(res.data?.data || null);
      } catch (e) {
        if (!isMounted) return;
        setError(e.message || 'Failed to fetch analytics');
      } finally {
        if (!isMounted) return;
        setLoading(false);
      }
    }
    fetchAnalytics();
    return () => { isMounted = false; };
  }, [brandName, categoryId]);

  return { data, loading, error };
}


