import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, parseISO, subDays } from 'date-fns';
import { api } from '../utils/api';
import './PriceHistoryPage.css';

// Time range options
const TIME_RANGES = {
  WEEK: { label: 'Last 7 days', days: 7 },
  MONTH: { label: 'Last 30 days', days: 30 },
  THREE_MONTHS: { label: 'Last 3 months', days: 90 },
  ALL: { label: 'All time', days: null }
};

export const PriceHistoryPage = () => {
  const { model } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const categoryId = searchParams.get('categoryId');
  const brand = searchParams.get('brand');
  
  const [priceData, setPriceData] = useState([]);
  const [rawPriceData, setRawPriceData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('ALL');
  const [categoryName, setCategoryName] = useState('');
  const [availableAttributes, setAvailableAttributes] = useState({});
  const [activeFilters, setActiveFilters] = useState({});

  const fetchPriceHistory = useCallback(async () => {
    if (!model) {
      setError('Model parameter is required');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({ model });
      if (categoryId) {
        params.append('categoryId', categoryId);
      }
      if (brand) {
        params.append('brand', brand);
      }
      
      const response = await api.get(`/models/prices?${params}`);
      console.log(response.data);
      console.log("Price history fetched");
      if (response.data.success && response.data.data) {
        console.log('Raw price data:', response.data.data);
        setRawPriceData(response.data.data);
        // Extract available attributes from the data
        extractAvailableAttributes(response.data.data);
      } else {
        setError('No price data available for this model');
      }
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [model, categoryId, brand]);

  const fetchCategoryName = useCallback(async () => {
    if (!categoryId) return;
    
    try {
      const response = await api.get(`/categories/${categoryId}`);
      if (response.data.success) {
        setCategoryName(response.data.data.name);
      }
    } catch (err) {
      console.error('Error fetching category name:', err);
    }
  }, [categoryId]);

  const extractAvailableAttributes = (data) => {
    const attributes = {};
    const allowedAttributes = ['Storage', 'Condition']; // Only keep these attributes
    
    data.forEach(item => {
      if (item.attributes) {
        Object.entries(item.attributes).forEach(([key, value]) => {
          // Only process allowed attributes
          if (allowedAttributes.includes(key)) {
            if (!attributes[key]) {
              attributes[key] = new Set();
            }
            attributes[key].add(value);
          }
        });
      }
    });

    // Convert Sets to sorted arrays
    const sortedAttributes = {};
    Object.keys(attributes).forEach(key => {
      sortedAttributes[key] = Array.from(attributes[key]).sort();
    });

    setAvailableAttributes(sortedAttributes);
  };

  const handleFilterChange = (attributeName, value) => {
    setActiveFilters(prev => {
      const newFilters = { ...prev };
      
      if (newFilters[attributeName] === value) {
        // If clicking the same filter, remove it
        delete newFilters[attributeName];
      } else {
        // Set new filter
        newFilters[attributeName] = value;
      }
      
      return newFilters;
    });
  };

  const clearAllFilters = () => {
    setActiveFilters({});
  };

  // Effect for fetching data from API (only runs when model/category/brand changes)
  useEffect(() => {
    fetchPriceHistory();
  }, [fetchPriceHistory]);

  useEffect(() => {
    fetchCategoryName();
  }, [fetchCategoryName]);

  // Effect for processing raw data (runs when rawPriceData, timeRange, or activeFilters change)
  useEffect(() => {
    if (rawPriceData.length === 0) {
      setPriceData([]);
      return;
    }
    
    processData(rawPriceData);
  }, [rawPriceData, timeRange, activeFilters]);

  const processData = (data) => {
    // Apply attribute filters first
    let filteredData = data.filter(item => {
      // Check if item matches all active filters
      return Object.entries(activeFilters).every(([attributeName, filterValue]) => {
        return item.attributes && item.attributes[attributeName] === filterValue;
      });
    });


    // Map filtered data to chart data format
    let chartData = filteredData.map(item => {
      const price = parseFloat(item.price || item.price_numeric); // Handle both old and new format
      const postDate = parseISO(item.post_time);
      return {
        // 'date' is used for the X-axis label format.
        date: format(postDate, 'yyyy-MM-dd'),
        // 'timestamp' is used for sorting and filtering.
        timestamp: postDate.getTime(),
        // 'price' is the value for the Y-axis.
        price: price,
        // Pass the full timestamp for more precise tooltips.
        post_time: item.post_time,
        // Include listing ID
        listing_id: item.listing_id,
        // Include attributes if available
        attributes: item.attributes || {}
      };
    });

    // Sort by date to ensure the line connects chronologically.
    chartData.sort((a, b) => a.timestamp - b.timestamp);

    // Apply time range filter if one is selected.
    if (TIME_RANGES[timeRange] && TIME_RANGES[timeRange].days) {
      const cutoffDate = subDays(new Date(), TIME_RANGES[timeRange].days).getTime();
      chartData = chartData.filter(item => item.timestamp >= cutoffDate);
    }

    // Calculate a 7-point moving average after all filtering.
    const movingAverageWindow = 50;
    for (let i = 0; i < chartData.length; i++) {
      // Get the last `movingAverageWindow` points.
      const start = Math.max(0, i - movingAverageWindow + 1);
      const end = i + 1;
      const windowSlice = chartData.slice(start, end);
      // Calculate the sum of prices in the window.
      const sum = windowSlice.reduce((acc, curr) => acc + curr.price, 0);
      // Assign the moving average to the current data point.
      chartData[i].movingAverage = Math.round(sum / windowSlice.length);
    }
    

    setPriceData(chartData);
  };

  const formatXAxisTick = (dateStr) => {
    return format(new Date(dateStr), 'MMM d');
  };

  const CustomDot = (props) => {
    const { cx, cy, payload } = props;
    if (payload && payload.listing_id) {
      return (
        <g>
          <circle cx={cx} cy={cy} r={3} fill="#8884d8" stroke="#fff" strokeWidth={1} />
          <text 
            x={cx} 
            y={cy - 10} 
            textAnchor="middle" 
            fontSize="8" 
            fill="#666"
            style={{ pointerEvents: 'none' }}
          >
            {payload.listing_id}
          </text>
        </g>
      );
    }
    return <circle cx={cx} cy={cy} r={3} fill="#8884d8" />;
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      console.log('Tooltip data:', data);
      console.log('Listing ID in tooltip:', data.listing_id);
      return (
        <div className="custom-tooltip">
          <p className="label">{format(parseISO(data.post_time), 'MMM d, yyyy HH:mm')}</p>
          <p style={{ fontSize: '12px', color: '#007bff', fontWeight: 'bold' }}>ID: {data.listing_id}</p>
          <p style={{ color: '#8884d8' }}>
            Price: €{data.price}
          </p>
          <p style={{ color: '#82ca9d' }}>
            Moving Avg: €{data.movingAverage}
          </p>
          {data.attributes && Object.keys(data.attributes).length > 0 && (
            <div className="attributes">
              {Object.entries(data.attributes).map(([key, value]) => (
                <p key={key} style={{ fontSize: '12px', color: '#666' }}>
                  {key}: {value}
                </p>
              ))}
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return <div className="loading">Loading price history...</div>;
  }

  if (error) {
    return (
      <div className="error">
        {error}
        <button onClick={() => navigate(-1)} className="back-button">
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="price-history-page">
      <div className="header">
        <button onClick={() => navigate(-1)} className="back-button">
          ← Back
        </button>
        <h1>Price History</h1>
      </div>

      <div className="info-section">
        <div className="info-item">Model: <strong>{model}</strong></div>
        {brand && <div className="info-item">Brand: <strong>{brand}</strong></div>}
        {categoryName && <div className="info-item">Category: <strong>{categoryName}</strong></div>}
        <div className="info-item">Total Data Points: <strong>{priceData.length}</strong></div>
      </div>

      <div className="controls">
        <div className="time-range-selector">
          {Object.entries(TIME_RANGES).map(([key, range]) => (
            <button
              key={key}
              className={`range-button ${timeRange === key ? 'active' : ''}`}
              onClick={() => setTimeRange(key)}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {Object.keys(availableAttributes).length > 0 && (
        <div className="attribute-filters">
          <div className="filter-header">
            <h3>Filter by Attributes</h3>
            {Object.keys(activeFilters).length > 0 && (
              <button className="clear-filters-button" onClick={clearAllFilters}>
                Clear All Filters
              </button>
            )}
          </div>
          
          {Object.entries(availableAttributes).map(([attributeName, values]) => (
            <div key={attributeName} className="attribute-filter-group">
              <h4>{attributeName}</h4>
              <div className="filter-buttons">
                {values.map(value => (
                  <button
                    key={value}
                    className={`filter-button ${activeFilters[attributeName] === value ? 'active' : ''}`}
                    onClick={() => handleFilterChange(attributeName, value)}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
          ))}
          
          {Object.keys(activeFilters).length > 0 && (
            <div className="active-filters">
              <span>Active filters: </span>
              {Object.entries(activeFilters).map(([attr, value]) => (
                <span key={attr} className="active-filter-tag">
                  {attr}: {value}
                  <button 
                    className="remove-filter" 
                    onClick={() => handleFilterChange(attr, value)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="chart-container">
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={priceData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
              tickFormatter={formatXAxisTick}
              interval="preserveStartEnd"
            />
            <YAxis 
              tickFormatter={(value) => `€${value}`}
              domain={['auto', 'auto']}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            
            <Line 
              type="monotone" 
              dataKey="price" 
              stroke="#8884d8" 
              name="Price"
              strokeWidth={1}
              dot={<CustomDot />}
              activeDot={{ r: 6, fill: '#8884d8' }}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="movingAverage"
              stroke="#82ca9d"
              name="7-Point Moving Average"
              strokeWidth={2}
              dot={false}
              activeDot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {priceData.length > 0 && (
        <div className="data-table-section">
          <h3>Listing Data</h3>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Listing ID</th>
                  <th>Date</th>
                  <th>Price</th>
                  <th>Storage</th>
                  <th>Condition</th>
                </tr>
              </thead>
              <tbody>
                {priceData.map((item, index) => (
                  <tr key={index}>
                    <td className="listing-id">{item.listing_id}</td>
                    <td>{format(parseISO(item.post_time), 'MMM d, yyyy HH:mm')}</td>
                    <td>€{item.price}</td>
                    <td>{item.attributes?.Storage || '-'}</td>
                    <td>{item.attributes?.Condition || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="statistics">
        <h3>Price Statistics</h3>
        <div className="stats-grid">
          {priceData.length > 0 && (
            <div className="stat-card">
              <h4>{model}</h4>
              <div className="stat-item">
                <span>Latest Price:</span>
                <strong>€{priceData[priceData.length - 1]?.price || 0}</strong>
              </div>
              <div className="stat-item">
                <span>Latest Avg Price:</span>
                <strong>€{priceData[priceData.length - 1]?.movingAverage || 0}</strong>
              </div>
              <div className="stat-item">
                <span>Lowest Price:</span>
                <strong>€{Math.min(...priceData.map(d => d.price))}</strong>
              </div>
              <div className="stat-item">
                <span>Highest Price:</span>
                <strong>€{Math.max(...priceData.map(d => d.price))}</strong>
              </div>
              <div className="stat-item">
                <span>Average Price:</span>
                <strong>€{Math.round(priceData.reduce((sum, d) => sum + d.price, 0) / priceData.length)}</strong>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}; 