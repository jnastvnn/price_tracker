import BaseModel from './BaseModel.js';
import { ATTRIBUTE_IDS, PAGINATION, STATUS } from '../constants/index.js';
import { normalizePagination } from '../utils/pagination.js';

/**
 * Category Domain Model
 * Represents a product category with hierarchical structure
 */
class Category extends BaseModel {
  static tableName = 'categories';

  constructor(data = {}) {
    super(data);
    
    // Core properties
    this.id = data.id || null;
    this.name = data.name || '';
    this.name_fi = data.name_fi || '';
    this.slug = data.slug || '';
    this.level = data.level || 1;
    this.parent_id = data.parent_id || null;
    this.sort_order = data.sort_order || 0;
    this.description = data.description || '';
    this.is_active = data.is_active !== undefined ? data.is_active : true;
    this.meta_title = data.meta_title || '';
    this.meta_description = data.meta_description || '';
    
    // Computed properties (not stored in database)
    this.children = data.children || [];
    this.parent = data.parent || null;
    this.breadcrumbs = data.breadcrumbs || [];
  }

  /**
   * Validation rules
   */
  validateRequired() {
    const errors = {};
    
    if (!this.name || this.name.trim().length === 0) {
      errors.name = 'Category name is required';
    }
    if (this.name && this.name.length > 255) {
      errors.name = 'Category name must be 255 characters or less';
    }
    if (this.level < 1 || this.level > 5) {
      errors.level = 'Category level must be between 1 and 5';
    }
    if (this.sort_order < 0) {
      errors.sort_order = 'Sort order cannot be negative';
    }
    return errors;
  }

  /**
   * Business Logic Methods
   */
  
  /**
   * Check if this is a root category (no parent)
   */
  isRootCategory() {
    return this.parent_id === null || this.parent_id === undefined;
  }

  /**
   * Check if this is a leaf category (no children)
   */
  isLeafCategory() {
    return this.children.length === 0;
  }

  /**
   * Check if category can have children based on level
   */
  canHaveChildren() {
    return this.level < 5; // Max 5 levels deep
  }

  /**
   * Get the full category path as string
   */
  getPath(separator = ' > ') {
    if (this.breadcrumbs.length === 0) {
      return this.name;
    }
    
    return [...this.breadcrumbs.map(b => b.name), this.name].join(separator);
  }

  /**
   * Generate URL-friendly slug from name
   */
  generateSlug() {
    if (!this.name) return '';
    
    return this.name
      .toLowerCase()
      .replace(/[åä]/g, 'a')
      .replace(/ö/g, 'o')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim('-');
  }

  /**
   * Get display name (prefer Finnish if available)
   */
  getDisplayName(locale = 'fi') {
    if (locale === 'fi' && this.name_fi) {
      return this.name_fi;
    }
    return this.name;
  }

  /**
   * Check if category is descendant of another category
   */
  isDescendantOf(ancestorId) {
    return this.breadcrumbs.some(breadcrumb => breadcrumb.id === ancestorId);
  }

  /**
   * Get category depth in hierarchy
   */
  getDepth() {
    return this.breadcrumbs.length + 1;
  }

  /**
   * Business rules before save
   */
  beforeSave() {
    super.beforeSave();
    
    // Auto-generate slug if not provided
    if (!this.slug) {
      this.slug = this.generateSlug();
    }
    
    // Auto-generate meta title if not provided
    if (!this.meta_title) {
      this.meta_title = this.name;
    }
    
    // Ensure sort_order is a number
    this.sort_order = parseInt(this.sort_order) || 0;
    
    // Ensure level is consistent with parent
    if (this.parent && this.parent.level) {
      this.level = this.parent.level + 1;
    }
  }

  /**
   * Convert to database format
   */
  toDatabase() {
    const data = super.toDatabase();
    
    // Remove computed properties
    delete data.children;
    delete data.parent;
    delete data.breadcrumbs;
    
    return data;
  }

  /**
   * Format for API response
   */
  toDisplayFormat() {
    return {
      id: this.id,
      name: this.name,
      name_fi: this.name_fi,
      slug: this.slug,
      level: this.level,
      parent_id: this.parent_id,
      sort_order: this.sort_order,
      description: this.description,
      is_active: this.is_active,
      path: this.getPath(),
      depth: this.getDepth(),
      is_root: this.isRootCategory(),
      is_leaf: this.isLeafCategory(),
      can_have_children: this.canHaveChildren(),
      children_count: this.children.length,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }

  /**
   * Add child category
   */
  addChild(childCategory) {
    if (!this.canHaveChildren()) {
      throw new Error('Category cannot have children at this level');
    }
    
    childCategory.parent_id = this.id;
    childCategory.level = this.level + 1;
    childCategory.parent = this;
    
    this.children.push(childCategory);
    return this;
  }

  /**
   * Remove child category
   */
  removeChild(childId) {
    this.children = this.children.filter(child => child.id !== childId);
    return this;
  }

  /**
   * Set parent category
   */
  setParent(parentCategory) {
    if (parentCategory && !parentCategory.canHaveChildren()) {
      throw new Error('Parent category cannot have children at this level');
    }
    
    this.parent = parentCategory;
    this.parent_id = parentCategory ? parentCategory.id : null;
    this.level = parentCategory ? parentCategory.level + 1 : 1;
    
    return this;
  }

  // --- Data Access Methods (Static) ---

  static async findByLevel(level) {
    return await this.findWhere({ level }, '*', 'name ASC');
  }

  static async findChildren(parentId) {
    return await this.findWhere({ parent_id: parentId }, '*', 'name ASC');
  }

  static async findModelsWithAvgPrice(categoryId, filters = {}) {
    const { limit, offset } = normalizePagination({
      page: filters.page,
      limit: filters.limit ?? PAGINATION.MAX_LIMIT
    });
    const query = `
      SELECT
        la.value_text AS model,
        COUNT(l.id) AS listing_count,
        ROUND(AVG(l.price_numeric)::numeric, 2) AS average_price
      FROM listings l
      JOIN listing_categories lc ON l.id = lc.listing_id
      JOIN listing_attributes la ON l.id = la.listing_id
      WHERE
        lc.category_id = $1
        AND (la.attribute_id = $2 OR la.attribute_id = $3)
        AND l.status = $4
        AND l.price_numeric IS NOT NULL
        AND la.value_text IS NOT NULL
        AND TRIM(la.value_text) != ''
      GROUP BY la.value_text
      HAVING COUNT(l.id) > 0
      ORDER BY listing_count DESC, model ASC
      LIMIT $5 OFFSET $6`;
    return await this.executeQuery(query, [
      categoryId,
      ATTRIBUTE_IDS.MODEL,
      ATTRIBUTE_IDS.BRAND,
      STATUS.SUCCESS,
      limit,
      offset,
    ]);
  }
  
  static async findBrandsWithAvgPrice(categoryId, filters = {}) {
    const { limit, offset } = normalizePagination({
      page: filters.page,
      limit: filters.limit ?? PAGINATION.MAX_LIMIT
    });
    const query = `
      WITH normalized_data AS (
        SELECT
          l.id,
          l.price_numeric,
          la.value_text AS original_brand,
          TRIM(UPPER(la.value_text)) AS normalized_brand
        FROM listings l
        JOIN listing_categories lc ON l.id = lc.listing_id
        JOIN listing_attributes la ON l.id = la.listing_id
        WHERE
          lc.category_id = $1
          AND la.attribute_id = $2
          AND l.status = $3
          AND l.price_numeric IS NOT NULL
          AND la.value_text IS NOT NULL
          AND TRIM(la.value_text) != ''
      )
      SELECT
        MODE() WITHIN GROUP (ORDER BY original_brand) AS brand,
        COUNT(id) AS listing_count,
        ROUND(AVG(price_numeric)::numeric, 2) AS average_price
      FROM normalized_data
      GROUP BY normalized_brand
      HAVING COUNT(id) > 0
      ORDER BY listing_count DESC, brand ASC
      LIMIT $4 OFFSET $5`;
    return await this.executeQuery(query, [
      categoryId,
      ATTRIBUTE_IDS.BRAND,
      STATUS.SUCCESS,
      limit,
      offset,
    ]);
  }

  static async findCategoryPath(categoryId) {
    const query = `
      WITH RECURSIVE category_path AS (
        SELECT id, name, parent_id, level, 0 as depth
        FROM categories WHERE id = $1
        UNION ALL
        SELECT c.id, c.name, c.parent_id, c.level, cp.depth + 1
        FROM categories c JOIN category_path cp ON c.id = cp.parent_id
      )
      SELECT id, name, level, depth FROM category_path ORDER BY depth DESC`;
    return await this.executeQuery(query, [categoryId]);
  }

  static async findCategoryTree(rootId = null) {
    const query = `
      WITH RECURSIVE category_tree AS (
        SELECT id, name, parent_id, level, ARRAY[id] as path, 1 as depth
        FROM categories 
        WHERE ${rootId ? 'parent_id = $1' : 'parent_id IS NULL'}
        UNION ALL
        SELECT c.id, c.name, c.parent_id, c.level, ct.path || c.id, ct.depth + 1
        FROM categories c JOIN category_tree ct ON c.parent_id = ct.id
        WHERE ct.depth < 10
      )
      SELECT * FROM category_tree ORDER BY path`;
    return await this.executeQuery(query, rootId ? [rootId] : []);
  }

  static async getCategoryStats(categoryId) {
    const query = `
      SELECT 
        COUNT(DISTINCT l.id) as total_listings,
        COUNT(DISTINCT la_brand.value_text) as unique_brands,
        COUNT(DISTINCT la_model.value_text) as unique_models,
        ROUND(AVG(l.price_numeric)::numeric, 2) as average_price,
        MIN(l.price_numeric) as min_price,
        MAX(l.price_numeric) as max_price
      FROM listings l
      JOIN listing_categories lc ON l.id = lc.listing_id
      LEFT JOIN listing_attributes la_brand ON l.id = la_brand.listing_id AND la_brand.attribute_id = $2
      LEFT JOIN listing_attributes la_model ON l.id = la_model.listing_id AND la_model.attribute_id = $3
      WHERE lc.category_id = $1 AND l.status = $4 AND l.price_numeric IS NOT NULL`;
    const result = await this.executeQuery(query, [categoryId, ATTRIBUTE_IDS.BRAND, ATTRIBUTE_IDS.MODEL, STATUS.SUCCESS]);
    return result[0] || null;
  }
}

export default Category; 
