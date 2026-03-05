
import React from 'react';
import { useParams } from 'react-router-dom';
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <main className="max-w-7xl mx-auto px-4 py-10">
        <section className="bg-white/80 backdrop-blur-sm border border-white/40 rounded-2xl shadow-md p-6 md:p-10">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900">{category.name}</h1>
            {category.name_fi && (
              <p className="text-gray-600 mt-1">Finnish name: {category.name_fi}</p>
            )}
            <div className="flex flex-wrap gap-4 text-sm text-gray-600 mt-4">
              <span className="px-3 py-1 rounded-full bg-gray-100">ID: {category.id}</span>
              <span className="px-3 py-1 rounded-full bg-gray-100">Level: {category.level}</span>
              {category.parent_id && (
                <span className="px-3 py-1 rounded-full bg-gray-100">
                  Parent: {category.parent_id}
                </span>
              )}
            </div>
          </div>

          {/* Listings */}
          <div className="mt-6">
            <CategoryListings categoryId={categoryId} />
          </div>
        </section>
      </main>
    </div>
  );
};
