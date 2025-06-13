import { beforeAll, afterAll, beforeEach } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../schema';

let testDb: ReturnType<typeof drizzle>;
let testSql: ReturnType<typeof postgres>;

// Global setup - connect to test database
beforeAll(async () => {
  // Use a separate test database or schema
  const connectionString = process.env.TEST_DATABASE_URL || 
    'postgresql://minecollect:minecollect_dev@localhost:5432/minecollect_test';
  
  // Create database connection
  testSql = postgres(connectionString, { 
    ssl: false,
    max: 10,
    onnotice: () => {}, // Suppress NOTICE messages
  });
  
  testDb = drizzle(testSql, { schema });

  try {
    // Create test database if it doesn't exist
    const mainConnectionString = 'postgresql://minecollect:minecollect_dev@localhost:5432/minecollect';
    const mainSql = postgres(mainConnectionString, { max: 1 });
    
    try {
      await mainSql`CREATE DATABASE minecollect_test`;
    } catch (error) {
      // Database might already exist, that's fine
      console.log('Test database already exists or creation failed:', (error as Error).message);
    } finally {
      await mainSql.end();
    }

    // Reconnect to the test database
    await testSql.end();
    testSql = postgres(connectionString, { 
      ssl: false,
      max: 10,
      onnotice: () => {},
    });
    testDb = drizzle(testSql, { schema });

    // Install required extensions in test database
    await testSql`CREATE EXTENSION IF NOT EXISTS vector`;
    await testSql`CREATE EXTENSION IF NOT EXISTS ltree`;
    await testSql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;
    await testSql`CREATE EXTENSION IF NOT EXISTS pg_trgm`;

    // Drop existing tables if they exist
    await testSql`DROP TABLE IF EXISTS "asset_tags" CASCADE`;
    await testSql`DROP TABLE IF EXISTS "nodes" CASCADE`;
    await testSql`DROP TABLE IF EXISTS "tags" CASCADE`;
    await testSql`DROP TABLE IF EXISTS "assets" CASCADE`;

    // Create tables using direct SQL
    await testSql`
      CREATE TABLE IF NOT EXISTS "assets" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "source_uri" text NOT NULL,
        "web_url" text,
        "content_hash" text NOT NULL,
        "path" ltree NOT NULL,
        "metadata" jsonb,
        "timestamp" timestamp with time zone,
        "root_node_id" uuid,
        CONSTRAINT "assets_source_uri_unique" UNIQUE("source_uri"),
        CONSTRAINT "assets_content_hash_unique" UNIQUE("content_hash")
      )
    `;

    await testSql`
      CREATE TABLE IF NOT EXISTS "nodes" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "asset_id" uuid NOT NULL,
        "parent_id" uuid,
        "title" text,
        "content" text,
        "embedding" vector(1536),
        "metadata" jsonb,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      )
    `;

    await testSql`
      CREATE TABLE IF NOT EXISTS "tags" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" text NOT NULL,
        "parent_id" uuid,
        CONSTRAINT "tags_name_unique" UNIQUE("name")
      )
    `;

    await testSql`
      CREATE TABLE IF NOT EXISTS "asset_tags" (
        "asset_id" uuid NOT NULL,
        "tag_id" uuid NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "asset_tags_asset_id_tag_id_pk" PRIMARY KEY("asset_id","tag_id")
      )
    `;

    // Create indexes
    await testSql`CREATE INDEX IF NOT EXISTS "source_uri_idx" ON "assets" ("source_uri")`;
    await testSql`CREATE INDEX IF NOT EXISTS "path_idx" ON "assets" USING GIST ("path")`;
    await testSql`CREATE INDEX IF NOT EXISTS "timestamp_idx" ON "assets" ("timestamp")`;
    await testSql`CREATE INDEX IF NOT EXISTS "node_asset_idx" ON "nodes" ("asset_id")`;
    await testSql`CREATE INDEX IF NOT EXISTS "node_parent_idx" ON "nodes" ("parent_id")`;

    // Create foreign key constraints
    await testSql`
      ALTER TABLE "nodes" ADD CONSTRAINT "nodes_asset_id_assets_id_fk" 
      FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE cascade ON UPDATE no action
    `;

    await testSql`
      ALTER TABLE "nodes" ADD CONSTRAINT "nodes_parent_id_nodes_id_fk" 
      FOREIGN KEY ("parent_id") REFERENCES "nodes"("id") ON DELETE set null ON UPDATE no action
    `;

    await testSql`
      ALTER TABLE "tags" ADD CONSTRAINT "tags_parent_id_tags_id_fk" 
      FOREIGN KEY ("parent_id") REFERENCES "tags"("id") ON DELETE set null ON UPDATE no action
    `;

    await testSql`
      ALTER TABLE "asset_tags" ADD CONSTRAINT "asset_tags_asset_id_assets_id_fk" 
      FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE cascade ON UPDATE no action
    `;

    await testSql`
      ALTER TABLE "asset_tags" ADD CONSTRAINT "asset_tags_tag_id_tags_id_fk" 
      FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE cascade ON UPDATE no action
    `;

    // Add the circular reference last, after both tables exist
    await testSql`
      ALTER TABLE "assets" ADD CONSTRAINT "assets_root_node_id_nodes_id_fk" 
      FOREIGN KEY ("root_node_id") REFERENCES "nodes"("id") ON DELETE set null ON UPDATE no action
    `;

  } catch (error) {
    console.error('Failed to set up test database:', error);
    throw error;
  }
}, 30000);

// Global teardown
afterAll(async () => {
  if (testSql) {
    await testSql.end();
  }
});

// Export test utilities
export { testDb, testSql };

// Clean up tables between tests
beforeEach(async () => {
  // Clear all tables in the correct order to avoid foreign key constraints
  await testDb.delete(schema.assetTags);
  await testDb.delete(schema.nodes);
  await testDb.delete(schema.tags);
  await testDb.delete(schema.assets);
}); 