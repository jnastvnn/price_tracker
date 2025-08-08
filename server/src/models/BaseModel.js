import pool from '../config/db.js';

/**
 * Base Model - Combines Domain Logic and Data Access
 * - Defines data structure, validation, and business rules
 * - Provides static methods for database operations (acting as a repository)
 */
class BaseModel {
  constructor(data = {}) {
    // Domain logic properties
    this.created_at = data.created_at || null;
    this.updated_at = data.updated_at || null;
    this.isNew = !data.id;
    this._originalData = { ...data };
  }

  // --- Domain Logic Methods ---

  getId() {
    return this.id || null;
  }

  isDirty() {
    return JSON.stringify(this.toJSON()) !== JSON.stringify(this._originalData);
  }

  getChanges() {
    const current = this.toJSON();
    const changes = {};
    Object.keys(current).forEach(key => {
      if (current[key] !== this._originalData[key]) {
        changes[key] = current[key];
      }
    });
    return changes;
  }

  markClean() {
    this._originalData = { ...this.toJSON() };
    this.isNew = false;
  }

  validate() {
    const errors = this.validateRequired ? this.validateRequired() : {};
    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }

  validateRequired() {
    return {};
  }

  beforeSave() {
    if (this.isNew) {
      this.created_at = new Date().toISOString();
    }
    this.updated_at = new Date().toISOString();
  }

  toJSON() {
    const obj = {};
    Object.keys(this).forEach(key => {
      if (!key.startsWith('_') && typeof this[key] !== 'function') {
        obj[key] = this[key];
      }
    });
    return obj;
  }

  toDatabase() {
    const data = this.toJSON();
    delete data.isNew;
    return data;
  }

  clone() {
    return new this.constructor(this.toJSON());
  }

  fill(data) {
    Object.keys(data).forEach(key => {
      if (data[key] !== undefined) {
        this[key] = data[key];
      }
    });
    return this;
  }

  toDisplayFormat() {
    return this.toJSON();
  }

  // --- Data Access Methods (Static) ---

  static async findAll(columns = '*', orderBy = 'id ASC', limit = null) {
    let query = `SELECT ${columns} FROM ${this.tableName} ORDER BY ${orderBy}`;
    const params = [];
    if (limit) {
      query += ` LIMIT $1`;
      params.push(limit);
    }
    const { rows } = await pool.query(query, params);
    return rows.map(row => new this(row));
  }

  static async findById(id, columns = '*') {
    const { rows } = await pool.query(
      `SELECT ${columns} FROM ${this.tableName} WHERE id = $1 LIMIT 1`,
      [id]
    );
    return rows[0] ? new this(rows[0]) : null;
  }

  static async findByIds(ids, columns = '*') {
    if (!ids.length) return [];
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    const { rows } = await pool.query(
      `SELECT ${columns} FROM ${this.tableName} WHERE id IN (${placeholders})`,
      ids
    );
    return rows.map(row => new this(row));
  }

  static async findWhere(conditions = {}, columns = '*', orderBy = 'id ASC') {
    const whereKeys = Object.keys(conditions);
    if (!whereKeys.length) return this.findAll(columns, orderBy);

    const whereClause = whereKeys.map((key, i) => `${key} = $${i + 1}`).join(' AND ');
    const values = Object.values(conditions);

    const { rows } = await pool.query(
      `SELECT ${columns} FROM ${this.tableName} WHERE ${whereClause} ORDER BY ${orderBy}`,
      values
    );
    return rows.map(row => new this(row));
  }

  static async insert(data, returning = '*') {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

    const { rows } = await pool.query(
      `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING ${returning}`,
      values
    );

    return new this(rows[0]);
  }

  static async updateById(id, data, returning = '*') {
    const columns = Object.keys(data);
    const values = Object.values(data);

    const setters = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');
    const { rows } = await pool.query(
      `UPDATE ${this.tableName} SET ${setters} WHERE id = $${columns.length + 1} RETURNING ${returning}`,
      [...values, id]
    );

    return new this(rows[0]);
  }

  static async deleteById(id) {
    const { rowCount } = await pool.query(`DELETE FROM ${this.tableName} WHERE id = $1`, [id]);
    return rowCount > 0;
  }

  static async count(conditions = {}) {
    const conditionKeys = Object.keys(conditions);
    let query = `SELECT COUNT(*) as count FROM ${this.tableName}`;
    const values = [];

    if (conditionKeys.length) {
      const whereClause = conditionKeys.map((key, i) => `${key} = $${i + 1}`).join(' AND ');
      query += ` WHERE ${whereClause}`;
      values.push(...Object.values(conditions));
    }

    const { rows } = await pool.query(query, values);
    return parseInt(rows[0].count, 10);
  }

  static async executeQuery(query, params = []) {
    const { rows } = await pool.query(query, params);
    return rows;
  }

  static async executeCountQuery(query, params = []) {
    const { rows } = await pool.query(query, params);
    return parseInt(rows[0].total || rows[0].count, 10);
  }
}

export default BaseModel; 
