import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const api = axios.create({
    baseURL: '/api',
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
    },
}); 

export const useBrands = (params = {}) => {
    const { id } = params;
    const [state, setState] = useState({
        brands: null,
        loading: false,
        error: null,
    });
    
    const fetchBrands = useCallback(async () => {
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
            const response = await api.get(`/categories/${numericId}/brands`);
            
            // Handle new API response format
            if (response.data.success) {
                setState(prev => ({ ...prev, brands: response.data.data, loading: false }));
                console.log(response.data.data);
            } else {
                // Handle API error response
                setState(prev => ({ 
                    ...prev, 
                    error: response.data.error || 'Failed to fetch brands', 
                    loading: false 
                }));
            }
        } catch (error) {
            console.error('Error fetching brands:', error);
            
            // Handle different error types
            let errorMessage = 'Failed to fetch brands';
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
        fetchBrands();
    }, [fetchBrands]);

    return state;
}   