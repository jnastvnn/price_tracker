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
      
      // Handle new API response format
      if (response.data.success) {
        setState(prev => ({
          ...prev,
          listings: response.data.data.listings,
          pagination: response.data.data.pagination,
          loading: false,
        }));
      } else {
        // Handle API error response
        setState(prev => ({
          ...prev,
          error: response.data.error || 'Failed to fetch listings',
          loading: false,
        }));
      }
    } catch (error) {
      console.error('Error fetching listings:', error);
      
      // Handle different error types
      let errorMessage = 'Failed to fetch listings';
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setState(prev => ({
        ...prev,
        error: errorMessage,
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