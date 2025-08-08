import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const api = axios.create({
    baseURL: '/api',
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
    },
});

export const useCategory = (params = {}) => {
    const { id } = params;

    const [state, setState] = useState({
        category: null,
        loading: false,
        error: null,
    });

    const fetchCategory = useCallback(async () => {
        // Ensure id is valid and convert to integer
        const numericId = parseInt(id, 10);
        if (!id || isNaN(numericId) || numericId <= 0) {
            setState(prev => ({ 
                ...prev, 
                error: 'Invalid category ID', 
                loading: false 
            }));
            return;
        }

        setState(prev => ({ ...prev, loading: true, error: null }));
        try {
            const response = await api.get(`/categories/${numericId}`);

            
            // Handle new API response format
            if (response.data.success) {
                setState(prev => ({ ...prev, category: response.data.data, loading: false }));
            } else {
                // Handle API error response
                setState(prev => ({ 
                    ...prev, 
                    error: response.data.error || 'Failed to fetch category', 
                    loading: false 
                }));
            }
        } catch (error) {
            console.error('Error fetching category:', error);
            
            // Handle different error types
            let errorMessage = 'Failed to fetch category';
            if (error.response?.data?.error) {
                errorMessage = error.response.data.error;
            } else if (error.message) {
                errorMessage = error.message;
            }
            
            setState(prev => ({ 
                ...prev, 
                error: errorMessage, 
                loading: false 
            }));
        }
    }, [id]);

    useEffect(() => {
        fetchCategory();
    }, [fetchCategory]);

    const refetch = useCallback(() => {
        fetchCategory();
    }, [fetchCategory]);

    return {
        ...state,
        refetch,
    };
}