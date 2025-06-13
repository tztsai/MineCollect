import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Create the connection string from environment variables
const connectionString = process.env.DATABASE_URL || 
  `postgresql://${process.env.DB_USER || 'minecollect'}:${process.env.DB_PASSWORD || 'minecollect_dev'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'minecollect'}`;

// Create the postgres client
export const sql = postgres(connectionString, {
  ssl: process.env.DB_SSL === 'true' ? 'require' : false,
  max: 20, // Maximum number of connections in the pool
  idle_timeout: 20,
  connect_timeout: 10,
});

// Create the Drizzle database instance with schema
export const db = drizzle(sql, { schema });

// Export the schema for use in other packages
export * from './schema'; 