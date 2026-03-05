import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, GeoJSON, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useBrandAnalytics } from '../hooks/useBrandAnalytics';
import { useBrandCoordinates } from '../hooks/useBrandCoordinates';
import { useBrandCategories } from '../hooks/useBrandCategories';
import proj4 from 'proj4';

const DEFAULT_FINLAND_VIEWPORT = {
  south: 59.0,
  west: 19.0,
  north: 70.5,
  east: 32.0
};

let cachedPostalBoundaries = null;
let cachedPostalBoundariesPromise = null;

// Fix for default marker icons in React-Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const MapViewportListener = ({ onChange }) => {
  const map = useMapEvents({
    moveend: (event) => onChange?.(event.target.getBounds())
  });

  useEffect(() => {
    onChange?.(map.getBounds());
  }, [map, onChange]);

  return null;
};

export const BrandPage = () => {
  const { brandName } = useParams();
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState(null); // Will be set once categories load
  const [mapViewport, setMapViewport] = useState(DEFAULT_FINLAND_VIEWPORT);
  
  const { data: categories, loading: loadingCategories } = useBrandCategories(brandName);
  const { data: analytics, loading: loadingAnalytics, error: errorAnalytics } = useBrandAnalytics(brandName, selectedCategory);
  const { data: coordinateBins, loading: loadingCoords, error: errorCoords } = useBrandCoordinates(
    brandName,
    selectedCategory,
    mapViewport
  );

  // Set the first category as default when categories load
  React.useEffect(() => {
    if (categories && categories.length > 0 && !selectedCategory) {
      setSelectedCategory(categories[0].id.toString());
    }
  }, [categories, selectedCategory]);

  // Process data for display
  const data = useMemo(() => {
    if (!analytics) {
      return null;
    }

    // Color mapping for conditions (Finnish)
    const conditionColors = {
      'Uusi': '#6ee7b7',        // New/Mint - bright green
      'Kuin uusi': '#34d399',   // Like new - green
      'Hyvä': '#facc15',        // Good - yellow
      'Kohtalainen': '#f59e0b', // Fair/Moderate - orange
      'Unknown': '#9ca3af'      // Unknown - gray
    };

    // Condition order for sorting
    const conditionOrder = ['Unknown', 'Kohtalainen', 'Hyvä', 'Kuin uusi', 'Uusi'];
    
    return {
      brand_name: analytics.brand_name,
      models: analytics.models || [],
      condition_breakdown: (analytics.condition_breakdown || [])
        .map(c => ({
          condition: c.condition,
          percentage: parseFloat(c.percentage) || 0,
          count: parseInt(c.count) || 0,
          avg_price: parseFloat(c.avg_price) || 0,
          color: conditionColors[c.condition] || '#9ca3af'
        }))
        .sort((a, b) => {
          const indexA = conditionOrder.indexOf(a.condition);
          const indexB = conditionOrder.indexOf(b.condition);
          // If not found in order array, put at the end
          return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
        }),
      market_position: analytics.market_position || {
        brand_avg_price: 0,
        category_avg_price: 0,
        price_vs_category_percent: 0,
        market_share_percentage: 0
      }
    };
  }, [analytics]);
  const currencyFormatter = useMemo(() => new Intl.NumberFormat('fi-FI', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0
  }), []);

  const handleViewportChange = useCallback((nextViewport) => {
    if (!nextViewport) return;
    setMapViewport((previous) => {
      if (
        previous &&
        previous.south === nextViewport.south &&
        previous.west === nextViewport.west &&
        previous.north === nextViewport.north &&
        previous.east === nextViewport.east
      ) {
        return previous;
      }
      return nextViewport;
    });
  }, []);

  // Loading and error states
  if (loadingCategories || loadingAnalytics || !selectedCategory) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (errorAnalytics) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Error: {errorAnalytics}</p>
          <button onClick={() => navigate(-1)} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">
            ← Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!data || categories.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">{categories.length === 0 ? 'No categories found for this brand' : 'No data available'}</p>
          <button onClick={() => navigate(-1)} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">
            ← Go Back
          </button>
        </div>
      </div>
    );
  }

  const marketShare = data.market_position.market_share_percentage || 0;
  const pieBackground = `conic-gradient(#60a5fa 0 ${marketShare}%, #e5e7eb ${marketShare}% 100%)`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-gray-200/60">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">← Back</button>
          <h1 className="text-2xl font-bold text-gray-900">Brand Analytics</h1>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Brand title card with category dropdown */}
        <div className="bg-white/80 backdrop-blur-sm border border-white/40 rounded-2xl p-6 shadow-md mb-6">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900">
              {data.brand_name} in{' '}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="inline-block px-4 py-2 border-2 border-blue-300 rounded-lg text-2xl md:text-3xl font-bold text-blue-600 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer transition-colors"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Models list */}
          <section className="bg-white/80 backdrop-blur-sm border border-white/40 rounded-2xl p-6 shadow-md flex flex-col">
            <div className="mb-4">
              <h3 className="text-xl font-bold text-gray-900 mb-1">Popular Models</h3>
              <p className="text-sm text-gray-500">Average price and time to sell</p>
            </div>
            <div className="space-y-4 overflow-y-auto pr-2" style={{ maxHeight: '800px' }}>
              {data.models.length > 0 ? (
                data.models.map((m, index) => (
                  <div 
                    key={m.model || index} 
                    className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-gray-50 to-white border border-gray-200 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-semibold text-sm">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">{m.model || 'Unknown'}</div>
                        <div className="text-sm text-gray-500 mt-1">
                          <span className="inline-flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {m.avg_sell_time_days ? `${parseFloat(m.avg_sell_time_days).toFixed(0)} days` : 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gray-900 tabular-nums">€{parseFloat(m.avg_price || 0).toFixed(0)}</div>
                      <div className="text-xs text-gray-500">avg price</div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">No models found</p>
              )}
            </div>
          </section>

          {/* Right column */}
          <div className="space-y-6">
            {/* Market position */}
            <section className="bg-white/80 backdrop-blur-sm border border-white/40 rounded-2xl p-6 shadow-md">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Market position</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <div>
                  <div className="text-sm text-gray-600 mb-1">Brand avg price</div>
                  <div className="text-3xl font-bold text-gray-900 tabular-nums">€{data.market_position.brand_avg_price}</div>
                  <div className="mt-3 text-sm text-gray-700">
                    Category avg price: <span className="font-medium">€{data.market_position.category_avg_price}</span>
                  </div>
                  <div className="text-sm text-gray-700">
                    vs category: <span className="font-medium">{data.market_position.price_vs_category_percent > 0 ? '+' : ''}{data.market_position.price_vs_category_percent}%</span>
                  </div>
                </div>
                <div className="flex flex-col items-center">
                  <div
                    className="w-40 h-40 rounded-full shadow-inner"
                    style={{ background: pieBackground }}
                    aria-label={`Market share ${marketShare}%`}
                  />
                  <div className="mt-3 text-sm text-gray-700">
                    Market share: <span className="font-semibold">{marketShare}%</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Condition breakdown */}
            <section className="bg-white/80 backdrop-blur-sm border border-white/40 rounded-2xl p-6 shadow-md">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Condition breakdown</h3>
              <div className="space-y-4">
                {/* Visual bar */}
                <div className="w-full h-6 rounded overflow-hidden flex">
                  {data.condition_breakdown.map((c) => (
                    <div
                      key={c.condition}
                      className="h-full"
                      style={{ width: `${c.percentage}%`, backgroundColor: c.color }}
                      title={`${c.condition}: ${c.percentage}%`}
                    />
                  ))}
                </div>
                
                {/* List with prices */}
                <div className="space-y-2">
                  {data.condition_breakdown.map((c) => {
                    const avgPrice = typeof c.avg_price === 'number' && !Number.isNaN(c.avg_price) ? c.avg_price : 0;
                    return (
                      <div 
                        key={c.condition} 
                        className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-gray-50 to-white border border-gray-200"
                      >
                        <div className="flex items-center gap-3">
                          <span 
                            className="inline-block w-4 h-4 rounded" 
                            style={{ backgroundColor: c.color }} 
                          />
                          <span className="font-medium text-gray-900">{c.condition}</span>
                          <span className="text-sm text-gray-500">({c.percentage}%)</span>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-gray-900 tabular-nums">
                            {currencyFormatter.format(avgPrice)}
                          </div>
                          <div className="text-xs text-gray-500">avg price</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* Geographic Distribution Map */}
        <div className="mt-6">
          <section className="bg-white/80 backdrop-blur-sm border border-white/40 rounded-2xl p-6 shadow-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Geographic Distribution</h3>
            {errorCoords && (
              <div className="mb-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Map data update failed: {errorCoords}
              </div>
            )}
            <div className="flex justify-center">
              <FinlandMap
                coordinateBins={coordinateBins}
                onViewportChange={handleViewportChange}
                loading={loadingCoords}
              />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

// Finland Map Component using Choropleth with Postal Code Boundaries
const FinlandMap = ({ coordinateBins = [], onViewportChange, loading = false }) => {
  const center = [64.0, 26.0];
  const [postalBoundaries, setPostalBoundaries] = useState(cachedPostalBoundaries);
  const [boundariesError, setBoundariesError] = useState(null);

  // Define projections (EPSG:3067 -> WGS84) once
  const projectToWgs84 = useMemo(() => {
    // EPSG:3067 (ETRS89 / TM35FIN) proj string
    const epsg3067 = '+proj=utm +zone=35 +ellps=GRS80 +units=m +no_defs +type=crs';
    const wgs84 = 'WGS84';
    return (x, y) => {
      const [lon, lat] = proj4(epsg3067, wgs84, [x, y]);
      return { lat, lon };
    };
  }, []);

  // Load postal code boundaries
  useEffect(() => {
    let isMounted = true;

    const reprojectCoords = (coords, geomType) => {
      if (geomType === 'MultiPolygon') {
        return coords.map((polygon) =>
          polygon.map((ring) =>
            ring.map(([x, y]) => {
              const { lat, lon } = projectToWgs84(x, y);
              return [lon, lat];
            })
          )
        );
      }
      if (geomType === 'Polygon') {
        return coords.map((ring) =>
          ring.map(([x, y]) => {
            const { lat, lon } = projectToWgs84(x, y);
            return [lon, lat];
          })
        );
      }
      return coords;
    };

    const loadPostalBoundaries = async () => {
      try {
        if (cachedPostalBoundaries) {
          if (isMounted) {
            setPostalBoundaries(cachedPostalBoundaries);
            setBoundariesError(null);
          }
          return;
        }

        if (!cachedPostalBoundariesPromise) {
          const baseUrl = (import.meta && import.meta.env && import.meta.env.BASE_URL) ? import.meta.env.BASE_URL : '/';
          const url = `${baseUrl.replace(/\/$/, '')}/data/finnish_postal_codes.geojson`;

          cachedPostalBoundariesPromise = fetch(url)
            .then((res) => {
              if (!res.ok) {
                throw new Error(`HTTP error ${res.status}`);
              }
              return res.json();
            })
            .then((data) => {
              const transformed = {
                ...data,
                features: (data.features || []).map((feature) => {
                  const geomType = feature.geometry?.type;
                  const coords = feature.geometry?.coordinates || [];
                  return {
                    ...feature,
                    geometry: {
                      ...feature.geometry,
                      coordinates: reprojectCoords(coords, geomType),
                    },
                  };
                }),
              };
              cachedPostalBoundaries = transformed;
              return transformed;
            })
            .catch((error) => {
              cachedPostalBoundariesPromise = null;
              throw error;
            });
        }

        const transformed = await cachedPostalBoundariesPromise;
        if (!isMounted) return;
        setPostalBoundaries(transformed);
        setBoundariesError(null);
      } catch (error) {
        if (!isMounted) return;
        const message = error instanceof Error ? error.message : 'Failed to load map data';
        setBoundariesError(message);
      }
    };

    loadPostalBoundaries();

    return () => {
      isMounted = false;
    };
  }, [projectToWgs84]);

  const notifyViewportChange = useCallback((bounds) => {
    if (!onViewportChange || !bounds) return;
    onViewportChange({
      south: +bounds.getSouth().toFixed(4),
      west: +bounds.getWest().toFixed(4),
      north: +bounds.getNorth().toFixed(4),
      east: +bounds.getEast().toFixed(4)
    });
  }, [onViewportChange]);

  // Count listings per postal region by summing one-day bins.
  const listingsByPostal = useMemo(() => {
    const counts = {};
    coordinateBins.forEach((bin) => {
      const postalRegion = String(bin.postal_region || '').substring(0, 3);
      if (!postalRegion) return;
      const count = Number(bin.listing_count) || 0;
      if (count <= 0) return;
      counts[postalRegion] = (counts[postalRegion] || 0) + count;
    });
    return counts;
  }, [coordinateBins]);

  // Get color based on listing count (light blue to dark blue gradient)
  const getColor = useCallback((count) => {
    if (!count || count === 0) return '#e5e7eb'; // Light gray for visibility
    if (count >= 50) return '#1e3a8a'; // Dark blue
    if (count >= 30) return '#1e40af'; // Deep blue
    if (count >= 20) return '#2563eb'; // Blue
    if (count >= 10) return '#3b82f6'; // Medium blue
    if (count >= 5) return '#60a5fa';  // Light blue
    if (count >= 3) return '#93c5fd';  // Lighter blue
    if (count >= 2) return '#bfdbfe';  // Very light blue
    return '#dbeafe';                   // Pale blue
  }, []);

  // Style for each postal code area
  const style = useCallback((feature) => {
    const postalCode = feature?.properties?.postinumeroalue;
    // Match by first 3 digits for medium-sized regions
    const postalRegion = String(postalCode || '').substring(0, 3);
    const count = listingsByPostal[postalRegion] || 0;

    return {
      fillColor: getColor(count),
      weight: 0.8,
      opacity: 1,
      color: '#6b7280',
      fillOpacity: count > 0 ? 0.7 : 0.5  // Make zero-count areas more visible
    };
  }, [getColor, listingsByPostal]);

  // Interaction handlers
  const onEachFeature = useCallback((feature, layer) => {
    const postalCode = feature.properties.postinumeroalue;
    const name = feature.properties.nimi;
    // Match by first 3 digits for medium-sized regions
    const postalRegion = String(postalCode || '').substring(0, 3);
    const count = listingsByPostal[postalRegion] || 0;

    layer.on({
      mouseover: (e) => {
        const target = e.target;
        target.setStyle({
          weight: 2,
          color: '#1f2937',
          fillOpacity: count > 0 ? 0.85 : 0.65
        });
        if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
          target.bringToFront();
        }
      },
      mouseout: (e) => {
        e.target.setStyle({
          weight: 0.8,
          color: '#6b7280',
          fillColor: getColor(count),
          fillOpacity: count > 0 ? 0.7 : 0.5
        });
      }
    });

    if (count > 0) {
      layer.bindPopup(`
        <div style="text-align: center;">
          <div style="font-weight: bold; font-size: 16px;">${count} listing${count !== 1 ? 's' : ''}</div>
          <div style="color: #6b7280; margin-top: 4px;">Postal Region: ${postalRegion}XX</div>
          <div style="font-size: 12px; color: #9ca3af;">${name}</div>
        </div>
      `);
    }
  }, [getColor, listingsByPostal]);

  return (
    <div className="relative w-full" style={{ height: '500px' }}>
      <MapContainer
        center={center}
        zoom={6}
        scrollWheelZoom={true}
        preferCanvas={true}
        style={{ height: '100%', width: '100%', borderRadius: '1rem' }}
        zoomControl={true}
      >
        <MapViewportListener onChange={notifyViewportChange} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          zIndex={1}
        />
        
        {postalBoundaries ? (
          <GeoJSON
            key={`postal-boundaries-${postalBoundaries.features?.length || 0}`}
            data={postalBoundaries}
            style={style}
            onEachFeature={onEachFeature}
            smoothFactor={0.3}
            pane="overlayPane"
          />
        ) : null}
      </MapContainer>
      
      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-white/95 backdrop-blur-sm p-3 rounded-lg shadow-md text-xs">
        <div className="font-semibold mb-2">Listings per Postal Code (1-day bins)</div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div style={{ width: 16, height: 16, backgroundColor: '#1e3a8a' }}></div>
            <span>50+</span>
          </div>
          <div className="flex items-center gap-2">
            <div style={{ width: 16, height: 16, backgroundColor: '#2563eb' }}></div>
            <span>20-49</span>
          </div>
          <div className="flex items-center gap-2">
            <div style={{ width: 16, height: 16, backgroundColor: '#3b82f6' }}></div>
            <span>10-19</span>
          </div>
          <div className="flex items-center gap-2">
            <div style={{ width: 16, height: 16, backgroundColor: '#60a5fa' }}></div>
            <span>5-9</span>
          </div>
          <div className="flex items-center gap-2">
            <div style={{ width: 16, height: 16, backgroundColor: '#93c5fd' }}></div>
            <span>3-4</span>
          </div>
          <div className="flex items-center gap-2">
            <div style={{ width: 16, height: 16, backgroundColor: '#bfdbfe' }}></div>
            <span>2</span>
          </div>
          <div className="flex items-center gap-2">
            <div style={{ width: 16, height: 16, backgroundColor: '#dbeafe' }}></div>
            <span>1</span>
          </div>
          <div className="flex items-center gap-2">
            <div style={{ width: 16, height: 16, backgroundColor: '#e5e7eb', border: '1px solid #d1d5db' }}></div>
            <span>0</span>
          </div>
        </div>
      </div>

      {!postalBoundaries && !boundariesError && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm rounded-2xl">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading postal code boundaries...</p>
          </div>
        </div>
      )}

      {loading && (
        <div className="absolute top-4 left-4 bg-white/95 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 shadow">
          Updating map data...
        </div>
      )}

      {coordinateBins.length === 0 && !loading && postalBoundaries && (
        <div className="absolute top-4 left-4 bg-white/95 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 shadow">
          No geographic data available for current view
        </div>
      )}

      {boundariesError && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm rounded-2xl">
          <div className="max-w-sm text-center text-sm text-red-600 px-4">
            Failed to load map data: {boundariesError}
          </div>
        </div>
      )}
    </div>
  );
};
