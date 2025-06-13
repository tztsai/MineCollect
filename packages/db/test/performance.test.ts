import { describe, it, expect, beforeAll } from 'vitest';
import { testDb, testSql } from './setup';
import { items, chunks } from '../schema';
import { eq, like, sql } from 'drizzle-orm';

describe('Performance Tests', () => {
  beforeAll(async () => {
    // Insert test data for performance testing
    const testItems = Array.from({ length: 100 }, (_, i) => ({
      sourceUri: `test://performance/item${i}`,
      contentHash: `perf${i}hash${Math.random()}`,
      path: `Performance.Test.Batch${Math.floor(i / 10)}.Item${i}`,
      sourceName: i % 3 === 0 ? 'twitter' : i % 3 === 1 ? 'readwise' : 'local',
      title: `Performance Test Item ${i}`,
      displayContent: `This is test content for performance testing item number ${i}. It contains various keywords like technology, artificial intelligence, machine learning, and data science.`,
      metadata: {
        batch: Math.floor(i / 10),
        index: i,
        category: i % 5 === 0 ? 'ai' : i % 5 === 1 ? 'web' : i % 5 === 2 ? 'mobile' : i % 5 === 3 ? 'backend' : 'other',
      },
      itemTimestamp: new Date(2023, 0, 1 + i), // Spread over 100 days
    }));

    await testDb.insert(items).values(testItems);

    // Insert chunks for vector search testing
    const allItems = await testDb.query.items.findMany();
    const testChunks = allItems.slice(0, 50).map((item, i) => ({
      itemId: item.id,
      content: `Chunk content for item ${i}: ${item.displayContent}`,
      embedding: Array.from({ length: 100 }, (_, j) => Math.sin(i * 0.1 + j * 0.01)), // Deterministic embeddings
      metadata: { chunkIndex: 0, itemIndex: i },
    }));

    await testDb.insert(chunks).values(testChunks);
  }, 30000);

  describe('Index Performance', () => {
    it('should perform fast lookups by sourceUri (unique index)', async () => {
      const startTime = Date.now();

      const item = await testDb.query.items.findFirst({
        where: eq(items.sourceUri, 'test://performance/item50'),
      });

      const endTime = Date.now();
      const queryTime = endTime - startTime;

      expect(item).toBeDefined();
      expect(item?.sourceUri).toBe('test://performance/item50');
      expect(queryTime).toBeLessThan(50); // Should be very fast with unique index
    });

    it('should perform efficient queries by sourceName (indexed)', async () => {
      const startTime = Date.now();

      const twitterItems = await testDb.query.items.findMany({
        where: eq(items.sourceName, 'twitter'),
      });

      const endTime = Date.now();
      const queryTime = endTime - startTime;

      expect(twitterItems.length).toBeGreaterThan(0);
      expect(queryTime).toBeLessThan(100); // Should be fast with index
      expect(twitterItems.every(item => item.sourceName === 'twitter')).toBe(true);
    });

    it('should perform efficient ltree path queries (GIST index)', async () => {
      const startTime = Date.now();

      // Query for items in a specific path subtree
      const batch5Items = await testSql`
        SELECT source_uri, path::text
        FROM items 
        WHERE path <@ 'Performance.Test.Batch5'::ltree
      `;

      const endTime = Date.now();
      const queryTime = endTime - startTime;

      expect(batch5Items.length).toBe(10); // Items 50-59
      expect(queryTime).toBeLessThan(100); // Should be fast with GIST index
      expect(batch5Items.every(item => item.path.startsWith('Performance.Test.Batch5'))).toBe(true);
    });

    it('should perform efficient timestamp range queries (indexed)', async () => {
      const startTime = Date.now();

      const startDate = new Date(2023, 0, 20); // Day 20
      const endDate = new Date(2023, 0, 30);   // Day 30

      const dateRangeItems = await testSql`
        SELECT source_uri, item_timestamp
        FROM items 
        WHERE item_timestamp BETWEEN ${startDate} AND ${endDate}
        ORDER BY item_timestamp
      `;

      const endTime = Date.now();
      const queryTime = endTime - startTime;

      expect(dateRangeItems.length).toBe(11); // Days 20-30 inclusive
      expect(queryTime).toBeLessThan(100); // Should be fast with index
    });
  });

  describe('Text Search Performance', () => {
    it('should perform text search efficiently', async () => {
      const startTime = Date.now();

      const searchResults = await testDb.query.items.findMany({
        where: like(items.displayContent, '%artificial intelligence%'),
      });

      const endTime = Date.now();
      const queryTime = endTime - startTime;

      expect(searchResults.length).toBeGreaterThan(0);
      expect(queryTime).toBeLessThan(200); // Text search might be slower without full-text index
      expect(searchResults.every(item => 
        item.displayContent?.includes('artificial intelligence')
      )).toBe(true);
    });

    it('should perform full-text search with pg_trgm', async () => {
      const startTime = Date.now();

      // Use similarity search with pg_trgm
      const searchResults = await testSql`
        SELECT source_uri, title, similarity(display_content, 'machine learning technology') as sim_score
        FROM items 
        WHERE display_content % 'machine learning technology'
        ORDER BY sim_score DESC
        LIMIT 10
      `;

      const endTime = Date.now();
      const queryTime = endTime - startTime;

      expect(searchResults.length).toBeGreaterThan(0);
      expect(queryTime).toBeLessThan(300); // Fuzzy search might be slower
      expect(searchResults[0].sim_score).toBeGreaterThan(0);
    });
  });

  describe('Vector Search Performance', () => {
    it('should perform vector similarity search efficiently', async () => {
      // Create a query embedding similar to the first item's embedding
      const queryEmbedding = Array.from({ length: 100 }, (_, j) => Math.sin(0.1 + j * 0.01));

      const startTime = Date.now();

      const similarChunks = await testSql`
        SELECT c.content, c.metadata, i.title,
               c.embedding <=> ${JSON.stringify(queryEmbedding)}::vector as distance
        FROM chunks c
        JOIN items i ON c.item_id = i.id
        ORDER BY c.embedding <=> ${JSON.stringify(queryEmbedding)}::vector
        LIMIT 5
      `;

      const endTime = Date.now();
      const queryTime = endTime - startTime;

      expect(similarChunks.length).toBe(5);
      expect(queryTime).toBeLessThan(500); // Vector search might be slower initially
      
      // Results should be ordered by similarity (ascending distance)
      for (let i = 1; i < similarChunks.length; i++) {
        expect(similarChunks[i].distance).toBeGreaterThanOrEqual(similarChunks[i - 1].distance);
      }
    });

    it('should handle batch vector insertions efficiently', async () => {
      // Create a test item
      const [testItem] = await testDb.insert(items).values({
        sourceUri: 'test://performance/batch-vectors',
        contentHash: 'batchvectorshash',
        path: 'Performance.BatchVectors',
        sourceName: 'test',
      }).returning();

      // Prepare batch of chunks with embeddings
      const batchSize = 20;
      const batchChunks = Array.from({ length: batchSize }, (_, i) => ({
        itemId: testItem.id,
        content: `Batch chunk ${i}`,
        embedding: Array.from({ length: 100 }, (_, j) => Math.random() - 0.5),
        metadata: { batchIndex: i },
      }));

      const startTime = Date.now();

      await testDb.insert(chunks).values(batchChunks);

      const endTime = Date.now();
      const insertTime = endTime - startTime;

      expect(insertTime).toBeLessThan(5000); // Should complete within 5 seconds

      // Verify all chunks were inserted
      const insertedChunks = await testDb.query.chunks.findMany({
        where: eq(chunks.itemId, testItem.id),
      });

      expect(insertedChunks.length).toBe(batchSize);
    });
  });

  describe('Complex Queries Performance', () => {
    it('should efficiently execute complex joins with filtering', async () => {
      const startTime = Date.now();

      const complexQuery = await testSql`
        SELECT DISTINCT
          i.source_uri,
          i.title,
          i.source_name,
          i.path::text,
          COUNT(c.id) as chunk_count,
          MAX(c.created_at) as latest_chunk
        FROM items i
        LEFT JOIN chunks c ON i.id = c.item_id
        WHERE i.source_name IN ('twitter', 'readwise')
          AND i.item_timestamp >= ${new Date(2023, 0, 1)}
          AND i.metadata->>'category' IN ('ai', 'web')
        GROUP BY i.id, i.source_uri, i.title, i.source_name, i.path
        HAVING COUNT(c.id) > 0
        ORDER BY latest_chunk DESC
        LIMIT 20
      `;

      const endTime = Date.now();
      const queryTime = endTime - startTime;

      expect(complexQuery.length).toBeGreaterThan(0);
      expect(queryTime).toBeLessThan(1000); // Complex query should complete within 1 second
      
      // Verify the results match our criteria
      expect(complexQuery.every(row => 
        ['twitter', 'readwise'].includes(row.source_name)
      )).toBe(true);
      
      expect(complexQuery.every(row => 
        row.chunk_count > 0
      )).toBe(true);
    });

    it('should handle concurrent read operations efficiently', async () => {
      const concurrentQueries = 10;
      const startTime = Date.now();

      // Execute multiple queries concurrently
      const promises = Array.from({ length: concurrentQueries }, (_, i) => 
        testDb.query.items.findMany({
          where: eq(items.sourceName, i % 2 === 0 ? 'twitter' : 'readwise'),
          limit: 10,
        })
      );

      const results = await Promise.all(promises);
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      expect(results.length).toBe(concurrentQueries);
      expect(results.every(result => result.length > 0)).toBe(true);
      expect(totalTime).toBeLessThan(2000); // All concurrent queries should complete within 2 seconds
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should handle large result sets efficiently with pagination', async () => {
      const pageSize = 20;
      const startTime = Date.now();

      // Test paginated query
      const firstPage = await testDb.query.items.findMany({
        limit: pageSize,
        offset: 0,
        orderBy: (items, { asc }) => [asc(items.createdAt)],
      });

      const secondPage = await testDb.query.items.findMany({
        limit: pageSize,
        offset: pageSize,
        orderBy: (items, { asc }) => [asc(items.createdAt)],
      });

      const endTime = Date.now();
      const queryTime = endTime - startTime;

      expect(firstPage.length).toBe(pageSize);
      expect(secondPage.length).toBe(pageSize);
      expect(queryTime).toBeLessThan(200); // Pagination should be fast
      
      // Verify no overlap between pages
      const firstPageIds = new Set(firstPage.map(item => item.id));
      const secondPageIds = new Set(secondPage.map(item => item.id));
      const intersection = [...firstPageIds].filter(id => secondPageIds.has(id));
      
      expect(intersection.length).toBe(0);
    });
  });
}); 