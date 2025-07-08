import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const useListings = (params = {}) => {
  const [state, setState] = useState({
    listings: [],
    loading: false,
    error: null,
    pagination: null,
  });

  const fetchListings = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const response = await api.get('/listings', { params });
      setState(prev => ({
        ...prev,
        listings: response.data.listings,
        pagination: response.data.pagination,
        loading: false,
      }));
    } catch (error) {
      console.error('Error fetching listings:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to fetch listings',
        loading: false,
      }));
    }
  }, [params.page, params.limit, params.search]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  const refetch = useCallback(() => {
    fetchListings();
  }, [fetchListings]);

  return {
    ...state,
    refetch,
  };
}; 