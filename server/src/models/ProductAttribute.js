import BaseModel from './BaseModel.js';

/**
 * ProductAttribute Domain Model
 * Represents a product attribute definition with data type and validation rules
 */
class ProductAttribute extends BaseModel {
  constructor(data = {}) {
    super(data);
    
    // Core properties
    this.id = data.id || null;
    this.name = data.name || '';
    this.display_name = data.display_name || '';
    this.data_type = data.data_type || 'text';
    this.is_required = data.is_required !== undefined ? data.is_required : false;
    this.is_filterable = data.is_filterable !== undefined ? data.is_filterable : false;
    this.is_searchable = data.is_searchable !== undefined ? data.is_searchable : false;
    this.sort_order = data.sort_order || 0;
    this.validation_rules = data.validation_rules || {};
    this.default_value = data.default_value || null;
    this.description = data.description || '';
    this.unit = data.unit || null;
    this.is_active = data.is_active !== undefined ? data.is_active : true;
    
    // Computed properties (not stored in database)
    this.options = data.options || [];
    this.categories = data.categories || [];
  }

  /**
   * Validation rules
   */
  validateRequired() {
    const errors = {};
    
    if (!this.name || this.name.trim().length === 0) {
      errors.name = 'Attribute name is required';
    }
    
    if (this.name && this.name.length > 100) {
      errors.name = 'Attribute name must be 100 characters or less';
    }
    
    if (!this.display_name || this.display_name.trim().length === 0) {
      errors.display_name = 'Display name is required';
    }
    
    const validDataTypes = ['text', 'number', 'decimal', 'boolean', 'date', 'select', 'multiselect', 'json'];
    if (!validDataTypes.includes(this.data_type)) {
      errors.data_type = `Data type must be one of: ${validDataTypes.join(', ')}`;
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
   * Check if attribute accepts multiple values
   */
  isMultiValue() {
    return ['multiselect', 'json'].includes(this.data_type);
  }

  /**
   * Check if attribute has predefined options
   */
  hasOptions() {
    return ['select', 'multiselect'].includes(this.data_type);
  }

  /**
   * Check if attribute is numeric
   */
  isNumeric() {
    return ['number', 'decimal'].includes(this.data_type);
  }

  /**
   * Check if attribute is text-based
   */
  isTextBased() {
    return ['text'].includes(this.data_type);
  }

  /**
   * Check if attribute is a boolean
   */
  isBoolean() {
    return this.data_type === 'boolean';
  }

  /**
   * Check if attribute is a date
   */
  isDate() {
    return this.data_type === 'date';
  }

  /**
   * Get validation rule by key
   */
  getValidationRule(key) {
    return this.validation_rules[key] || null;
  }

  /**
   * Set validation rule
   */
  setValidationRule(key, value) {
    this.validation_rules[key] = value;
    return this;
  }

  /**
   * Get formatted display name with unit
   */
  getDisplayNameWithUnit() {
    if (this.unit) {
      return `${this.display_name} (${this.unit})`;
    }
    return this.display_name;
  }

  /**
   * Validate attribute value against its data type and rules
   */
  validateValue(value) {
    const errors = [];
    
    // Check if required and value is empty
    if (this.is_required && (value === null || value === undefined || value === '')) {
      errors.push(`${this.display_name} is required`);
      return errors;
  }

    // Skip validation if value is empty and not required
    if (!this.is_required && (value === null || value === undefined || value === '')) {
      return errors;
    }
    
    // Validate based on data type
    switch (this.data_type) {
      case 'number':
        if (isNaN(value) || !Number.isInteger(Number(value))) {
          errors.push(`${this.display_name} must be a whole number`);
        }
        break;
        
      case 'decimal':
        if (isNaN(value)) {
          errors.push(`${this.display_name} must be a number`);
        }
        break;
        
      case 'boolean':
        if (typeof value !== 'boolean' && value !== 'true' && value !== 'false' && value !== 1 && value !== 0) {
          errors.push(`${this.display_name} must be true or false`);
        }
        break;
        
      case 'date':
        if (isNaN(Date.parse(value))) {
          errors.push(`${this.display_name} must be a valid date`);
        }
        break;
        
      case 'select':
        if (this.options.length > 0 && !this.options.includes(value)) {
          errors.push(`${this.display_name} must be one of: ${this.options.join(', ')}`);
        }
        break;
        
      case 'multiselect':
        if (Array.isArray(value)) {
          const invalidOptions = value.filter(v => !this.options.includes(v));
          if (invalidOptions.length > 0) {
            errors.push(`${this.display_name} contains invalid options: ${invalidOptions.join(', ')}`);
          }
        } else {
          errors.push(`${this.display_name} must be an array`);
        }
        break;
        
      case 'text':
        if (typeof value !== 'string') {
          errors.push(`${this.display_name} must be text`);
        }
        break;
    }
    
    // Apply custom validation rules
    const minLength = this.getValidationRule('min_length');
    if (minLength && typeof value === 'string' && value.length < minLength) {
      errors.push(`${this.display_name} must be at least ${minLength} characters`);
    }
    
    const maxLength = this.getValidationRule('max_length');
    if (maxLength && typeof value === 'string' && value.length > maxLength) {
      errors.push(`${this.display_name} must be no more than ${maxLength} characters`);
    }
    
    const minValue = this.getValidationRule('min_value');
    if (minValue && this.isNumeric() && Number(value) < minValue) {
      errors.push(`${this.display_name} must be at least ${minValue}`);
    }
    
    const maxValue = this.getValidationRule('max_value');
    if (maxValue && this.isNumeric() && Number(value) > maxValue) {
      errors.push(`${this.display_name} must be no more than ${maxValue}`);
    }
    
    return errors;
  }

  /**
   * Convert value to appropriate data type
   */
  castValue(value) {
    if (value === null || value === undefined) {
      return this.default_value;
    }
    
    switch (this.data_type) {
      case 'number':
        return parseInt(value, 10);
        
      case 'decimal':
        return parseFloat(value);
        
      case 'boolean':
        if (typeof value === 'boolean') return value;
        if (value === 'true' || value === 1 || value === '1') return true;
        if (value === 'false' || value === 0 || value === '0') return false;
        return Boolean(value);
        
      case 'date':
        return new Date(value).toISOString();
        
      case 'multiselect':
        if (Array.isArray(value)) return value;
        if (typeof value === 'string') return value.split(',').map(v => v.trim());
        return [value];
        
      case 'json':
        if (typeof value === 'object') return value;
        if (typeof value === 'string') {
          try {
            return JSON.parse(value);
          } catch {
            return value;
          }
        }
        return value;
        
      default:
        return String(value);
    }
  }

  /**
   * Generate input HTML type for forms
   */
  getInputType() {
    switch (this.data_type) {
      case 'number':
      case 'decimal':
        return 'number';
      case 'boolean':
        return 'checkbox';
      case 'date':
        return 'date';
      case 'select':
        return 'select';
      case 'multiselect':
        return 'select-multiple';
      default:
        return 'text';
    }
  }

  /**
   * Business rules before save
   */
  beforeSave() {
    super.beforeSave();
    
    // Auto-generate display name if not provided
    if (!this.display_name) {
      this.display_name = this.name.replace(/[_-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    
    // Ensure sort_order is a number
    this.sort_order = parseInt(this.sort_order) || 0;
    
    // Ensure validation_rules is an object
    if (typeof this.validation_rules !== 'object') {
      this.validation_rules = {};
    }
  }

  /**
   * Convert to database format
   */
  toDatabase() {
    const data = super.toDatabase();
    
    // Remove computed properties
    delete data.options;
    delete data.categories;
    
    // Ensure validation_rules is stored as JSON
    if (typeof data.validation_rules === 'object') {
      data.validation_rules = JSON.stringify(data.validation_rules);
    }
    
    return data;
  }

  /**
   * Format for API response
   */
  toDisplayFormat() {
    return {
      id: this.id,
      name: this.name,
      display_name: this.display_name,
      display_name_with_unit: this.getDisplayNameWithUnit(),
      data_type: this.data_type,
      is_required: this.is_required,
      is_filterable: this.is_filterable,
      is_searchable: this.is_searchable,
      sort_order: this.sort_order,
      validation_rules: this.validation_rules,
      default_value: this.default_value,
      description: this.description,
      unit: this.unit,
      is_active: this.is_active,
      is_multi_value: this.isMultiValue(),
      has_options: this.hasOptions(),
      is_numeric: this.isNumeric(),
      is_text_based: this.isTextBased(),
      is_boolean: this.isBoolean(),
      is_date: this.isDate(),
      input_type: this.getInputType(),
      options: this.options,
      categories: this.categories,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }

  /**
   * Add option to select/multiselect attribute
   */
  addOption(option) {
    if (this.hasOptions() && !this.options.includes(option)) {
      this.options.push(option);
    }
    return this;
  }

  /**
   * Remove option from select/multiselect attribute
   */
  removeOption(option) {
    this.options = this.options.filter(o => o !== option);
    return this;
  }

  /**
   * Set options for select/multiselect attribute
   */
  setOptions(options) {
    if (this.hasOptions()) {
      this.options = Array.isArray(options) ? options : [];
    }
    return this;
  }
}

export default ProductAttribute; 