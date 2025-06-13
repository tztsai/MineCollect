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

    // Create tables using direct SQL since drizzle push isn't working
    await testSql`
      CREATE TABLE IF NOT EXISTS "items" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "source_uri" text NOT NULL,
        "canonical_uri" text,
        "content_hash" text NOT NULL,
        "path" ltree NOT NULL,
        "source_name" text NOT NULL,
        "title" text,
        "display_content" text,
        "raw_content" jsonb,
        "metadata" jsonb,
        "item_timestamp" timestamp with time zone,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "items_source_uri_unique" UNIQUE("source_uri"),
        CONSTRAINT "items_content_hash_unique" UNIQUE("content_hash")
      )
    `;

    await testSql`
      CREATE TABLE IF NOT EXISTS "chunks" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "item_id" uuid NOT NULL,
        "content" text NOT NULL,
        "embedding" vector(1536),
        "metadata" jsonb,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
      )
    `;

    await testSql`
      CREATE TABLE IF NOT EXISTS "tags" (
        "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        "name" text NOT NULL,
        CONSTRAINT "tags_name_unique" UNIQUE("name")
      )
    `;

    await testSql`
      CREATE TABLE IF NOT EXISTS "item_tags" (
        "item_id" uuid NOT NULL,
        "tag_id" integer NOT NULL,
        CONSTRAINT "item_tags_item_id_tag_id_pk" PRIMARY KEY("item_id","tag_id")
      )
    `;

    // Create indexes
    await testSql`CREATE INDEX IF NOT EXISTS "source_name_idx" ON "items" ("source_name")`;
    await testSql`CREATE INDEX IF NOT EXISTS "path_idx" ON "items" USING GIST ("path")`;
    await testSql`CREATE INDEX IF NOT EXISTS "item_timestamp_idx" ON "items" ("item_timestamp")`;
    await testSql`CREATE INDEX IF NOT EXISTS "chunk_item_id_idx" ON "chunks" ("item_id")`;

    // Create foreign key constraints
    await testSql`
      DO $$ BEGIN
        ALTER TABLE "chunks" ADD CONSTRAINT "chunks_item_id_items_id_fk" 
        FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE cascade ON UPDATE no action;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `;

    await testSql`
      DO $$ BEGIN
        ALTER TABLE "item_tags" ADD CONSTRAINT "item_tags_item_id_items_id_fk" 
        FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE cascade ON UPDATE no action;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `;

    await testSql`
      DO $$ BEGIN
        ALTER TABLE "item_tags" ADD CONSTRAINT "item_tags_tag_id_tags_id_fk" 
        FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE cascade ON UPDATE no action;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
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
  await testDb.delete(schema.itemTags);
  await testDb.delete(schema.chunks);
  await testDb.delete(schema.tags);
  await testDb.delete(schema.items);
}); 