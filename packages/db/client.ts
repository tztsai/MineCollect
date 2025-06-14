import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { Config } from 'drizzle-kit';
import * as schema from './schema';
import drizzleConfig from './drizzle.config';

// Extract database credentials from the config with proper typing
const { dbCredentials } = drizzleConfig as Config;
const { user, password, host, port, database, ssl } = dbCredentials;

// Create the connection string from environment variables
const connectionString = 
  `postgresql://${user}:${password}@${host}:${port}/${database}`;

// Create the postgres client
export const sql = postgres(connectionString, {
  ssl: ssl && 'require',
  max: 20, // Maximum number of connections in the pool
  idle_timeout: 20,
  connect_timeout: 10,
});

// Create the Drizzle database instance with schema
export const db = drizzle(sql, { schema });

// Export the schema for use in other packages
export * from './schema'; 