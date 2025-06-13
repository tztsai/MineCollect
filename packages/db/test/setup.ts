import { beforeAll, afterAll, beforeEach } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../schema';
import { randomUUID } from 'crypto';

// Setup test database connection
const connectionString = process.env.TEST_DATABASE_URL || 
  'postgresql://minecollect:minecollect_dev@localhost:5432/minecollect_test';

// Create SQL client
export const testSql = postgres(connectionString, { 
  ssl: false,
  max: 10,
  onnotice: () => {}, // Suppress NOTICE messages
});

// Create a unique schema for each test run to avoid conflicts
const testSchema = `test_${randomUUID().replace(/-/g, '_')}`;

// Setup and teardown for tests
beforeAll(async () => {
  console.log(`Setting up test schema: ${testSchema}`);
  
  // Create the test schema
  await testSql`CREATE SCHEMA IF NOT EXISTS ${testSql.unsafe(testSchema)}`;
  
  // Set the search path to our test schema
  await testSql`SET search_path TO ${testSql.unsafe(testSchema)}, public`;
  
  // Create the PostgreSQL extensions if they don't exist
  await testSql`CREATE EXTENSION IF NOT EXISTS vector`;
  await testSql`CREATE EXTENSION IF NOT EXISTS ltree`;
  
  // Create tables with the updated schema
  await testSql`
    CREATE TABLE IF NOT EXISTS ${testSql.unsafe(`${testSchema}.assets`)} (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "source_uri" text NOT NULL UNIQUE,
      "web_url" text,
      "content_hash" text NOT NULL UNIQUE,
      "path" ltree NOT NULL,
      "metadata" jsonb,
      "timestamp" timestamptz,
      "root_node_id" uuid
    )
  `;
  
  await testSql`
    CREATE TABLE IF NOT EXISTS ${testSql.unsafe(`${testSchema}.nodes`)} (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "asset_id" uuid NOT NULL REFERENCES ${testSql.unsafe(`${testSchema}.assets`)}("id") ON DELETE CASCADE,
      "parent_id" uuid REFERENCES ${testSql.unsafe(`${testSchema}.nodes`)}("id"),
      "title" text,
      "content" text,
      "embedding" vector(1536),
      "metadata" jsonb,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now()
    )
  `;
  
  await testSql`
    CREATE TABLE IF NOT EXISTS ${testSql.unsafe(`${testSchema}.tags`)} (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "name" text NOT NULL UNIQUE,
      "parent_id" uuid REFERENCES ${testSql.unsafe(`${testSchema}.tags`)}("id"),
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now()
    )
  `;
  
  await testSql`
    CREATE TABLE IF NOT EXISTS ${testSql.unsafe(`${testSchema}.asset_tags`)} (
      "asset_id" uuid NOT NULL REFERENCES ${testSql.unsafe(`${testSchema}.assets`)}("id") ON DELETE CASCADE,
      "tag_id" uuid NOT NULL REFERENCES ${testSql.unsafe(`${testSchema}.tags`)}("id") ON DELETE CASCADE,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY ("asset_id", "tag_id")
    )
  `;
  
  // Create indexes
  await testSql`CREATE INDEX IF NOT EXISTS "source_uri_idx" ON ${testSql.unsafe(`${testSchema}.assets`)} ("source_uri")`;
  await testSql`CREATE INDEX IF NOT EXISTS "path_idx" ON ${testSql.unsafe(`${testSchema}.assets`)} USING GIST ("path")`;
  await testSql`CREATE INDEX IF NOT EXISTS "timestamp_idx" ON ${testSql.unsafe(`${testSchema}.assets`)} ("timestamp")`;
  await testSql`CREATE INDEX IF NOT EXISTS "node_asset_idx" ON ${testSql.unsafe(`${testSchema}.nodes`)} ("asset_id")`;
  await testSql`CREATE INDEX IF NOT EXISTS "node_parent_idx" ON ${testSql.unsafe(`${testSchema}.nodes`)} ("parent_id")`;
  await testSql`CREATE INDEX IF NOT EXISTS "node_embedding_idx" ON ${testSql.unsafe(`${testSchema}.nodes`)} USING ivfflat ("embedding" vector_l2_ops)`;
  
  // Add the circular reference for rootNodeId
  await testSql`
    ALTER TABLE ${testSql.unsafe(`${testSchema}.assets`)} 
    ADD CONSTRAINT "assets_root_node_id_fk" 
    FOREIGN KEY ("root_node_id") REFERENCES ${testSql.unsafe(`${testSchema}.nodes`)}("id") ON DELETE SET NULL
  `;
  
  // Create drizzle instance with the test schema
  testDb = drizzle(testSql, { 
    schema,
    // We'll set the schema via SQL search_path instead
  });
});

// Export the testDb variable
export let testDb: ReturnType<typeof drizzle>;

// Clean up tables between tests
beforeEach(async () => {
  // Clear all tables in a single transaction to avoid deadlocks
  await testSql.begin(async sql => {
    await sql`TRUNCATE TABLE ${sql.unsafe(`${testSchema}.asset_tags`)}, ${sql.unsafe(`${testSchema}.tags`)}, ${sql.unsafe(`${testSchema}.nodes`)}, ${sql.unsafe(`${testSchema}.assets`)} CASCADE`;
  });
});

afterAll(async () => {
  // Drop the test schema
  await testSql`DROP SCHEMA IF EXISTS ${testSql.unsafe(testSchema)} CASCADE`;
  
  // Close the database connection
  await testSql.end();
}); 