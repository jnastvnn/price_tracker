import { PAGINATION } from '../constants/index.js';

export const normalizePagination = (filters = {}) => {
  const page = Math.max(
    PAGINATION.DEFAULT_PAGE,
    Number(filters.page) || PAGINATION.DEFAULT_PAGE
  );
  const limit = Math.min(
    PAGINATION.MAX_LIMIT,
    Math.max(1, Number(filters.limit) || PAGINATION.DEFAULT_LIMIT)
  );
  const offset = (page - 1) * limit;

  return { page, limit, offset };
};

export const buildPagination = (page, limit, totalItems) => {
  const totalPages = Math.ceil(totalItems / limit);
  return {
    currentPage: parseInt(page, 10),
    totalPages,
    totalItems,
    itemsPerPage: parseInt(limit, 10),
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
    nextPage: page < totalPages ? Number(page) + 1 : null,
    prevPage: page > 1 ? Number(page) - 1 : null
  };
};
