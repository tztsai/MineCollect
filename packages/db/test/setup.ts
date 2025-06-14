import { beforeAll, afterAll } from 'vitest';
import { db } from '../client';
import { sources, nodes, tags, nodeTags } from '../schema';
import { sql } from 'drizzle-orm';

// Global test setup
beforeAll(async () => {
  // Ensure we're using a test database
  // This could be a separate test DB or we could use transactions
  try {
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS ltree`);
    console.log('Test database setup complete');
  } catch (error) {
    console.error('Error setting up test database:', error);
    throw error;
  }
});

// Global test teardown
afterAll(async () => {
  // Clean up after all tests
  try {
    await db.delete(nodeTags);
    await db.delete(tags);
    await db.delete(nodes);
    await db.delete(sources);
    console.log('Test database cleanup complete');
  } catch (error) {
    console.error('Error cleaning up test database:', error);
  }
}); 