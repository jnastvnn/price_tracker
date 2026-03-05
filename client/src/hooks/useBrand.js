import { useState, useEffect, useCallback } from 'react';
import { api } from '../utils/api'; 

export const useBrand = (params = {}) => {
    const {name} = params
    const [state, setState] = useState({
        brand : null,
        loading : false,
        error : null
    })

    const fetchBrand = useCallback(async () => {

        setState(prev => ({ ...prev, loading: true, error: null }));

        try {
            const response = await api.get(`/brand/${name}`);
            console.log(response)

        } catch (error){

        }



    },[name]);

    useEffect(() => {
        fetchBrand();
    }, [fetchBrand]);

    return state;


}