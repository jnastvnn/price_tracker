import React, { useState, useEffect } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';

const Breadcrumbs = () => {
  const location = useLocation();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const buildBreadcrumbs = async () => {
      setLoading(true);
      const crumbs = [{ label: 'Home', path: '/' }];

      try {
        // Parse current route to build breadcrumbs
        const pathSegments = location.pathname.split('/').filter(Boolean);
        
        if (pathSegments.length === 0) {
          setBreadcrumbs(crumbs);
          setLoading(false);
          return;
        }

        // Handle different route patterns
        switch (pathSegments[0]) {
          case 'category':
            await handleCategoryBreadcrumbs(crumbs, params.categoryId);
            break;
          
          case 'brand':
            await handleBrandBreadcrumbs(crumbs, params.brandName, searchParams.get('categoryId'));
            break;
          
          case 'model':
            await handleModelBreadcrumbs(crumbs, params.modelName, searchParams.get('categoryId'));
            break;
          
          case 'search':
            handleSearchBreadcrumbs(crumbs, searchParams.get('q'));
            break;
          
          case 'categories':
            crumbs.push({ label: 'All Categories', path: '/categories' });
            break;
          
          case 'dashboard':
            crumbs.push({ label: 'Dashboard', path: '/dashboard' });
            break;
          
          default:
            // Unknown route, just add the path
            crumbs.push({ label: pathSegments[0], path: `/${pathSegments[0]}` });
        }

        setBreadcrumbs(crumbs);
      } catch (error) {
        console.error('Error building breadcrumbs:', error);
        setBreadcrumbs(crumbs);
      } finally {
        setLoading(false);
      }
    };

    buildBreadcrumbs();
  }, [location.pathname, params, searchParams]);

  const handleCategoryBreadcrumbs = async (crumbs, categoryId) => {
    if (!categoryId) return;

    try {
      // Fetch category hierarchy
      const response = await axios.get(`/api/categories/${categoryId}/hierarchy`);
      const hierarchy = response.data;

      // Add each level of the category hierarchy
      hierarchy.forEach((category, index) => {
        crumbs.push({
          label: category.name,
          path: `/category/${category.id}`,
          isActive: index === hierarchy.length - 1
        });
      });
    } catch (error) {
      // Fallback if hierarchy endpoint doesn't exist
      try {
        const response = await axios.get(`/api/categories/${categoryId}`);
        crumbs.push({
          label: response.data.name || `Category ${categoryId}`,
          path: `/category/${categoryId}`,
          isActive: true
        });
      } catch (fallbackError) {
        crumbs.push({
          label: `Category ${categoryId}`,
          path: `/category/${categoryId}`,
          isActive: true
        });
      }
    }
  };

  const handleBrandBreadcrumbs = async (crumbs, brandName, categoryId) => {
    // Add category if available
    if (categoryId) {
      await handleCategoryBreadcrumbs(crumbs, categoryId);
    } else {
      crumbs.push({ label: 'Brands', path: '/brands' });
    }

    // Add brand
    const brandPath = categoryId ? 
      `/brand/${encodeURIComponent(brandName)}?categoryId=${categoryId}` :
      `/brand/${encodeURIComponent(brandName)}`;
    
    crumbs.push({
      label: brandName,
      path: brandPath,
      isActive: true
    });
  };

  const handleModelBreadcrumbs = async (crumbs, modelName, categoryId) => {
    // Add category if available
    if (categoryId) {
      await handleCategoryBreadcrumbs(crumbs, categoryId);
    } else {
      crumbs.push({ label: 'Models', path: '/models' });
    }

    // Add model
    const modelPath = categoryId ? 
      `/model/${encodeURIComponent(modelName)}?categoryId=${categoryId}` :
      `/model/${encodeURIComponent(modelName)}`;
    
    crumbs.push({
      label: modelName,
      path: modelPath,
      isActive: true
    });
  };

  const handleSearchBreadcrumbs = (crumbs, query) => {
    crumbs.push({ label: 'Search Results', path: '/search' });
    if (query) {
      crumbs.push({
        label: `"${query}"`,
        path: `/search?q=${encodeURIComponent(query)}`,
        isActive: true
      });
    }
  };

  if (loading) {
    return (
      <nav className="breadcrumbs loading">
        <span>Loading...</span>
      </nav>
    );
  }

  if (breadcrumbs.length <= 1) {
    return null; // Don't show breadcrumbs on home page
  }

  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb navigation">
      <ol className="breadcrumb-list">
        {breadcrumbs.map((crumb, index) => (
          <li key={index} className="breadcrumb-item">
            {index < breadcrumbs.length - 1 ? (
              <>
                <Link to={crumb.path} className="breadcrumb-link">
                  {crumb.label}
                </Link>
                <span className="breadcrumb-separator" aria-hidden="true">
                  /
                </span>
              </>
            ) : (
              <span className="breadcrumb-current" aria-current="page">
                {crumb.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};

export default Breadcrumbs; 