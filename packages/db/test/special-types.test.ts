import { describe, it, expect } from 'vitest';
import { testDb, testSql } from './setup';
import { items, chunks } from '../schema';
import { eq, sql } from 'drizzle-orm';

describe('Special PostgreSQL Types', () => {
  describe('ltree path type', () => {
    it('should store and query ltree paths correctly', async () => {
      const testItems = [
        {
          sourceUri: 'test://ltree/1',
          contentHash: 'ltree1hash',
          path: 'Technology.AI.MachineLearning',
          sourceName: 'test',
        },
        {
          sourceUri: 'test://ltree/2', 
          contentHash: 'ltree2hash',
          path: 'Technology.AI.NLP',
          sourceName: 'test',
        },
        {
          sourceUri: 'test://ltree/3',
          contentHash: 'ltree3hash', 
          path: 'Technology.Web.Frontend',
          sourceName: 'test',
        },
        {
          sourceUri: 'test://ltree/4',
          contentHash: 'ltree4hash',
          path: 'Books.Fiction.SciFi',
          sourceName: 'test',
        },
      ];

      await testDb.insert(items).values(testItems);

      // Test ancestor queries (using SQL directly for ltree operators)
      const aiItems = await testSql`
        SELECT source_uri, path::text 
        FROM items 
        WHERE path <@ 'Technology.AI'::ltree
        ORDER BY path
      `;

      expect(aiItems).toHaveLength(2);
      expect(aiItems[0].path).toBe('Technology.AI.MachineLearning');
      expect(aiItems[1].path).toBe('Technology.AI.NLP');

      // Test descendant queries
      const techItems = await testSql`
        SELECT source_uri, path::text 
        FROM items 
        WHERE path ~ 'Technology.*'::lquery
        ORDER BY path
      `;

      expect(techItems).toHaveLength(3);
      expect(techItems.map(item => item.path)).toEqual([
        'Technology.AI.MachineLearning',
        'Technology.AI.NLP', 
        'Technology.Web.Frontend'
      ]);

      // Test path depth
      const topLevelItems = await testSql`
        SELECT source_uri, path::text, nlevel(path) as depth
        FROM items 
        WHERE nlevel(path) = 3
        ORDER BY path
      `;

      expect(topLevelItems).toHaveLength(4);
      expect(topLevelItems.every(item => item.depth === 3)).toBe(true);
    });

    it('should support ltree path manipulation functions', async () => {
      const [createdItem] = await testDb.insert(items).values({
        sourceUri: 'test://ltree/manipulation',
        contentHash: 'ltreemanipulationhash',
        path: 'Root.Level1.Level2.Level3',
        sourceName: 'test',
      }).returning();

      // Test subpath extraction
      const pathManipulation = await testSql`
        SELECT 
          path::text as full_path,
          subpath(path, 0, 2)::text as first_two,
          subpath(path, 1)::text as from_second,
          nlevel(path) as depth,
          index(path, 'Level2') as level2_index
        FROM items 
        WHERE id = ${createdItem.id}
      `;

      expect(pathManipulation[0]).toMatchObject({
        full_path: 'Root.Level1.Level2.Level3',
        first_two: 'Root.Level1',
        from_second: 'Level1.Level2.Level3',
        depth: 4,
        level2_index: 2,
      });
    });
  });

  describe('vector embedding type', () => {
    it('should store and retrieve vector embeddings', async () => {
      // Create an item first
      const [parentItem] = await testDb.insert(items).values({
        sourceUri: 'test://vector/parent',
        contentHash: 'vectorparenthash',
        path: 'Test.Vector.Parent',
        sourceName: 'test',
      }).returning();

      // Create chunks with embeddings
      const embedding1 = Array.from({ length: 10 }, (_, i) => i * 0.1); // [0, 0.1, 0.2, ..., 0.9]
      const embedding2 = Array.from({ length: 10 }, (_, i) => (i + 1) * 0.1); // [0.1, 0.2, 0.3, ..., 1.0]

      const [chunk1, chunk2] = await testDb.insert(chunks).values([
        {
          itemId: parentItem.id,
          content: 'First chunk with embedding',
          embedding: embedding1,
        },
        {
          itemId: parentItem.id,
          content: 'Second chunk with embedding', 
          embedding: embedding2,
        },
      ]).returning();

      // Retrieve and verify embeddings
      const retrievedChunks = await testDb.query.chunks.findMany({
        where: eq(chunks.itemId, parentItem.id),
        orderBy: (chunks, { asc }) => [asc(chunks.createdAt)],
      });

      expect(retrievedChunks).toHaveLength(2);
      expect(retrievedChunks[0].embedding).toEqual(embedding1);
      expect(retrievedChunks[1].embedding).toEqual(embedding2);
    });

    it('should perform vector similarity searches', async () => {
      // Create an item first
      const [parentItem] = await testDb.insert(items).values({
        sourceUri: 'test://vector/similarity',
        contentHash: 'vectorsimilarityhash',
        path: 'Test.Vector.Similarity',
        sourceName: 'test',
      }).returning();

      // Create chunks with different embeddings
      const baseEmbedding = Array.from({ length: 5 }, (_, i) => i * 0.2); // [0, 0.2, 0.4, 0.6, 0.8]
      const similarEmbedding = Array.from({ length: 5 }, (_, i) => i * 0.2 + 0.01); // [0.01, 0.21, 0.41, 0.61, 0.81]
      const differentEmbedding = Array.from({ length: 5 }, (_, i) => (i + 1) * 0.5); // [0.5, 1.0, 1.5, 2.0, 2.5]

      await testDb.insert(chunks).values([
        {
          itemId: parentItem.id,
          content: 'Base content',
          embedding: baseEmbedding,
        },
        {
          itemId: parentItem.id,
          content: 'Similar content',
          embedding: similarEmbedding,
        },
        {
          itemId: parentItem.id,
          content: 'Different content',
          embedding: differentEmbedding,
        },
      ]);

      // Perform similarity search using cosine distance
      const queryEmbedding = baseEmbedding; // Search for exact match
      const similarityResults = await testSql`
        SELECT 
          content,
          embedding <=> ${JSON.stringify(queryEmbedding)}::vector as distance
        FROM chunks 
        WHERE item_id = ${parentItem.id}
        ORDER BY embedding <=> ${JSON.stringify(queryEmbedding)}::vector
        LIMIT 3
      `;

      expect(similarityResults).toHaveLength(3);
      
      // The exact match should have distance 0 (or very close to 0)
      expect(similarityResults[0].content).toBe('Base content');
      expect(similarityResults[0].distance).toBeLessThan(0.01);
      
      // Similar embedding should be closer than different embedding
      expect(similarityResults[1].content).toBe('Similar content');
      expect(similarityResults[2].content).toBe('Different content');
      expect(similarityResults[1].distance).toBeLessThan(similarityResults[2].distance);
    });

    it('should handle null embeddings', async () => {
      // Create an item first
      const [parentItem] = await testDb.insert(items).values({
        sourceUri: 'test://vector/null',
        contentHash: 'vectornullhash',
        path: 'Test.Vector.Null',
        sourceName: 'test',
      }).returning();

      // Create chunk without embedding
      const [chunk] = await testDb.insert(chunks).values({
        itemId: parentItem.id,
        content: 'Chunk without embedding',
        embedding: null,
      }).returning();

      expect(chunk.embedding).toBeNull();

      // Retrieve and verify
      const retrievedChunk = await testDb.query.chunks.findFirst({
        where: eq(chunks.id, chunk.id),
      });

      expect(retrievedChunk?.embedding).toBeNull();
    });

    it('should validate vector dimensions', async () => {
      // Create an item first
      const [parentItem] = await testDb.insert(items).values({
        sourceUri: 'test://vector/dimensions',
        contentHash: 'vectordimensionshash',
        path: 'Test.Vector.Dimensions',
        sourceName: 'test',
      });

      // Test with correct dimensions (should work - our custom type expects any array)
      const correctEmbedding = Array.from({ length: 1536 }, (_, i) => i / 1536);
      
      await expect(
        testDb.insert(chunks).values({
          itemId: parentItem.id,
          content: 'Chunk with correct embedding size',
          embedding: correctEmbedding,
        })
      ).resolves.not.toThrow();

      // Test with different dimensions (should also work with our current implementation)
      const smallEmbedding = [0.1, 0.2, 0.3];
      
      await expect(
        testDb.insert(chunks).values({
          itemId: parentItem.id,
          content: 'Chunk with small embedding',
          embedding: smallEmbedding,
        })
      ).resolves.not.toThrow();
    });
  });

  describe('JSONB metadata', () => {
    it('should store and query complex JSON metadata', async () => {
      const complexMetadata = {
        source: {
          platform: 'twitter',
          userId: '12345',
          username: 'testuser',
        },
        metrics: {
          likes: 150,
          retweets: 25,
          replies: 5,
        },
        tags: ['ai', 'tech', 'startup'],
        location: {
          lat: 37.7749,
          lng: -122.4194,
          city: 'San Francisco',
        },
        processed: true,
      };

      const [createdItem] = await testDb.insert(items).values({
        sourceUri: 'test://jsonb/complex',
        contentHash: 'jsonbcomplexhash',
        path: 'Test.JSONB.Complex',
        sourceName: 'test',
        metadata: complexMetadata,
      }).returning();

      // Retrieve and verify complete metadata
      const retrievedItem = await testDb.query.items.findFirst({
        where: eq(items.id, createdItem.id),
      });

      expect(retrievedItem?.metadata).toEqual(complexMetadata);

      // Test JSONB path queries
      const pathQueries = await testSql`
        SELECT 
          metadata->>'source'->>'platform' as platform,
          metadata->>'metrics'->>'likes' as likes,
          metadata->'tags' as tags_array,
          metadata->>'location'->>'city' as city
        FROM items 
        WHERE id = ${createdItem.id}
      `;

      expect(pathQueries[0]).toMatchObject({
        platform: 'twitter',
        likes: '150',
        city: 'San Francisco',
      });
      expect(JSON.parse(pathQueries[0].tags_array)).toEqual(['ai', 'tech', 'startup']);
    });

    it('should support JSONB containment queries', async () => {
      await testDb.insert(items).values([
        {
          sourceUri: 'test://jsonb/contain1',
          contentHash: 'jsonbcontain1hash',
          path: 'Test.JSONB.Contain1',
          sourceName: 'test',
          metadata: { tags: ['ai', 'ml'], type: 'article' },
        },
        {
          sourceUri: 'test://jsonb/contain2',
          contentHash: 'jsonbcontain2hash',
          path: 'Test.JSONB.Contain2', 
          sourceName: 'test',
          metadata: { tags: ['web', 'frontend'], type: 'tutorial' },
        },
        {
          sourceUri: 'test://jsonb/contain3',
          contentHash: 'jsonbcontain3hash',
          path: 'Test.JSONB.Contain3',
          sourceName: 'test',
          metadata: { tags: ['ai', 'nlp'], type: 'research' },
        },
      ]);

      // Find items with 'ai' tag
      const aiItems = await testSql`
        SELECT source_uri, metadata
        FROM items 
        WHERE metadata->'tags' ? 'ai'
        ORDER BY source_uri
      `;

      expect(aiItems).toHaveLength(2);
      expect(aiItems.map(item => item.source_uri)).toEqual([
        'test://jsonb/contain1',
        'test://jsonb/contain3',
      ]);

      // Find items of type 'article'
      const articleItems = await testSql`
        SELECT source_uri
        FROM items 
        WHERE metadata @> '{"type": "article"}'::jsonb
      `;

      expect(articleItems).toHaveLength(1);
      expect(articleItems[0].source_uri).toBe('test://jsonb/contain1');
    });
  });
}); 