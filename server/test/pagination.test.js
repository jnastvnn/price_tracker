import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPagination,
  buildPaginationWithoutCount,
  normalizePagination,
} from '../src/utils/pagination.js';

test('normalizePagination uses defaults and clamps values', () => {
  const { page, limit, offset } = normalizePagination({ page: 0, limit: 1000 });
  assert.equal(page, 1);
  assert.equal(limit, 100);
  assert.equal(offset, 0);
});

test('normalizePagination calculates offset', () => {
  const { page, limit, offset } = normalizePagination({ page: 3, limit: 20 });
  assert.equal(page, 3);
  assert.equal(limit, 20);
  assert.equal(offset, 40);
});

test('buildPagination returns navigation info', () => {
  const pagination = buildPagination(2, 10, 35);
  assert.equal(pagination.totalPages, 4);
  assert.equal(pagination.hasNextPage, true);
  assert.equal(pagination.hasPrevPage, true);
});

test('buildPaginationWithoutCount returns next/prev metadata without totals', () => {
  const pagination = buildPaginationWithoutCount(1, 12, 12, true);
  assert.equal(pagination.totalPages, null);
  assert.equal(pagination.totalItems, null);
  assert.equal(pagination.hasNextPage, true);
  assert.equal(pagination.hasPrevPage, false);
  assert.equal(pagination.exactTotal, false);
});
