import pg from 'pg';
import env from './env.js';
import logger from '../utils/logger.js';

const { Pool } = pg;

const pool = new Pool({
  connectionString: env.databaseUrl,
  max: env.db.poolMax,
  idleTimeoutMillis: env.db.idleTimeoutMs,
  connectionTimeoutMillis: env.db.connectionTimeoutMs,
  ssl: env.db.ssl ? { rejectUnauthorized: false } : false,
});

// Test the connection
pool.on('connect', () => {
  logger.info('Connected to the database');
});

pool.on('error', (err) => {
  logger.error('Database connection error', { message: err.message });
  process.exit(-1);
});

export default pool; 
