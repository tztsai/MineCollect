import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dbCredentials: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'minecollect',
    password: process.env.DB_PASSWORD || 'minecollect_dev',
    database: process.env.DB_NAME || 'minecollect',
    ssl: process.env.DB_SSL === 'true',
  },
  driver: 'pg',
  schema: './schema.ts',
  out: './migrations',
  verbose: true,
  strict: true,
});