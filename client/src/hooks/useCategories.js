import { useEffect, useState } from 'react';
import { api } from '../utils/api';

export function useCategories() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    
    async function fetchCategories() {
      setLoading(true);
      setError(null);
      
      try {
        const res = await api.get('/categories');
        if (!isMounted) return;
        
        if (res.data.success) {
          setData(res.data.data || []);
        } else {
          setError(res.data.error || 'Failed to fetch categories');
        }
      } catch (e) {
        if (!isMounted) return;
        setError(e.message || 'Failed to fetch categories');
      } finally {
        if (!isMounted) return;
        setLoading(false);
      }
    }
    
    fetchCategories();
    return () => { isMounted = false; };
  }, []);

  return { data, loading, error };
}

