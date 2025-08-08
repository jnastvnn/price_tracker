
import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCategory } from '../hooks/useCategory';
import { CategoryListings } from '../components/CategoryListings';




// Individual category tree node component

export const CategoryPage = () => {
  const { categoryId } = useParams();
  const { category, loading, error } = useCategory({id: categoryId});


  // Handle loading state
  if (loading) {
    return <div>Loading category...</div>;
  }

  // Handle error state
  if (error) {
    return <div>Error: {error}</div>;
  }

  // Handle case where category doesn't exist
  if (!category) {
    return <div>Category not found</div>;
  }

  // Render the category data
  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      {/* Category Header */}
      <div style={{ 
        borderBottom: '2px solid #eee', 
        paddingBottom: '20px', 
        marginBottom: '30px' 
      }}>
        <h1 style={{ margin: '0 0 10px 0', color: '#333' }}>
          {category.name}
        </h1>
        {category.name_fi && (
          <p style={{ margin: '0 0 10px 0', color: '#666', fontStyle: 'italic' }}>
            Finnish name: {category.name_fi}
          </p>
        )}
        <div style={{ display: 'flex', gap: '20px', fontSize: '14px', color: '#888' }}>
          <span>Category ID: {category.id}</span>
          <span>Level: {category.level}</span>
          {category.parent_id && <span>Parent ID: {category.parent_id}</span>}
        </div>
      </div>



      {/* Category Listings */}
      <CategoryListings categoryId={categoryId} />
    </div>
  );
};
