import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const useCategoryListings = (categoryId, options = {}) => {
  const { page = 1, limit = 10, search = '', brands = [] } = options;
  const [state, setState] = useState({
    listings: [],
    loading: false,
    error: null,
    pagination: null,
  });

  const fetchListings = useCallback(async () => {
    // Ensure categoryId is valid and convert to integer
    const numericCategoryId = parseInt(categoryId, 10);
    if (!categoryId || isNaN(numericCategoryId) || numericCategoryId <= 0) {
      setState(prev => ({ 
        ...prev, 
        error: 'Invalid category ID', 
        loading: false 
      }));
      return;
    }
    
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const params = {
        category: numericCategoryId,
        page,
        limit,
        ...(search && { search }),
        ...(brands.length > 0 && { brands })
      };
      
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
      console.error('Error fetching category listings:', error);
      
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
  }, [categoryId, page, limit, search, brands]);

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