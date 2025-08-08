import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Optional: Add a response interceptor for consistent error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Try to extract a specific error message from the server response
    const message = error.response?.data?.error || error.message || 'An unexpected error occurred';
    
    // It's better to reject with an Error object for consistency
    return Promise.reject(new Error(message));
  }
);
