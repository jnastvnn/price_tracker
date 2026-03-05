import { useEffect, useState } from 'react';
import { api } from '../utils/api';

export function useBrandCategories(brandName) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!brandName) {
      setData([]);
      return;
    }

    let isMounted = true;
    
    async function fetchBrandCategories() {
      setLoading(true);
      setError(null);
      
      try {
        const encodedBrandName = encodeURIComponent(brandName);
        const res = await api.get(`/brands/${encodedBrandName}/categories`);
        if (!isMounted) return;
        
        if (res.data.success) {
          setData(res.data.data || []);
        } else {
          setError(res.data.error || 'Failed to fetch brand categories');
        }
      } catch (e) {
        if (!isMounted) return;
        setError(e.message || 'Failed to fetch brand categories');
      } finally {
        if (!isMounted) return;
        setLoading(false);
      }
    }
    
    fetchBrandCategories();
    return () => { isMounted = false; };
  }, [brandName]);

  return { data, loading, error };
}

