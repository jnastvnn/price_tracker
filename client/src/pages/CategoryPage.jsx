
import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCategory } from '../hooks/useCategory';
import { CategoryListings } from '../components/CategoryListings';

// Individual category tree node component

export const CategoryPage = () => {
  const navigate = useNavigate();
  const { categoryId } = useParams();
  const { category, loading, error } = useCategory({id: categoryId});


  // Handle loading state
  if (loading) {
    return <div className="app-shell app-loading">Loading category...</div>;
  }

  // Handle error state
  if (error) {
    return (
      <div className="app-shell app-error">
        <div className="app-error-box">
          <div className="font-semibold mb-2">Error</div>
          <div className="app-muted mb-4">{error}</div>
        </div>
      </div>
    );
  }

  // Handle case where category doesn't exist
  if (!category) {
    return <div className="app-shell app-empty">Category not found</div>;
  }

  // Render the category data
  return (
    <div className="app-shell">
      <main className="app-container px-4 py-6 md:py-8">
        <section className="app-panel px-5 py-5 md:px-6 md:py-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate(-1)}
                  aria-label="Go back"
                  className="app-btn"
                >
                  ← Back
                </button>
                <div className="min-w-0">
                  <h1 className="text-2xl md:text-3xl font-bold text-[var(--landing-text-strong)] truncate">
                    {category.name}
                  </h1>
                  {category.name_fi && (
                    <p className="app-subtitle mt-1">Finnish name: {category.name_fi}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 text-sm lg:justify-end">
              <span className="app-chip">Category {category.id}</span>
              <span className="app-chip">Level {category.level}</span>
              {category.parent_id && <span className="app-chip">Parent {category.parent_id}</span>}
            </div>
          </div>
        </section>

        <div className="mt-4">
          <CategoryListings categoryId={categoryId} category={category} />
        </div>
      </main>
    </div>
  );
};
