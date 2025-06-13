import { describe, it, expect } from 'vitest';
import { testDb, testSql } from './setup';
import { assets, nodes } from '../schema';
import { eq, sql } from 'drizzle-orm';

// Create a 1536-dimensional vector for testing
function createTestEmbedding(seed: number): number[] {
  // Use integer values to avoid floating point precision issues
  return Array.from({ length: 1536 }, (_, i) => Math.round((seed + i) * 100) / 100);
}

describe('Special PostgreSQL Types', () => {
  describe('ltree path type', () => {
    it('should store and query ltree paths correctly', async () => {
      const testAssets = [
        {
          sourceUri: 'test://ltree/1',
          contentHash: 'ltree1hash',
          path: 'Technology.AI.MachineLearning',
        },
        {
          sourceUri: 'test://ltree/2', 
          contentHash: 'ltree2hash',
          path: 'Technology.AI.NLP',
        },
        {
          sourceUri: 'test://ltree/3',
          contentHash: 'ltree3hash', 
          path: 'Technology.Web.Frontend',
        },
        {
          sourceUri: 'test://ltree/4',
          contentHash: 'ltree4hash',
          path: 'Books.Fiction.SciFi',
        },
      ];

      await testDb.insert(assets).values(testAssets);

      // Test ancestor queries (using SQL directly for ltree operators)
      const aiAssets = await testSql`
        SELECT source_uri, path::text 
        FROM assets 
        WHERE path <@ 'Technology.AI'::ltree
        ORDER BY path
      `;

      expect(aiAssets).toHaveLength(2);
      expect(aiAssets[0].path).toBe('Technology.AI.MachineLearning');
      expect(aiAssets[1].path).toBe('Technology.AI.NLP');

      // Test descendant queries
      const techAssets = await testSql`
        SELECT source_uri, path::text 
        FROM assets 
        WHERE path ~ 'Technology.*'::lquery
        ORDER BY path
      `;

      expect(techAssets).toHaveLength(3);
      expect(techAssets.map(item => item.path)).toEqual([
        'Technology.AI.MachineLearning',
        'Technology.AI.NLP', 
        'Technology.Web.Frontend'
      ]);

      // Test path depth
      const topLevelAssets = await testSql`
        SELECT source_uri, path::text, nlevel(path) as depth
        FROM assets 
        WHERE nlevel(path) = 3
        ORDER BY path
      `;

      expect(topLevelAssets).toHaveLength(4);
      expect(topLevelAssets.every(item => item.depth === 3)).toBe(true);
    });

    it('should support ltree path manipulation functions', async () => {
      const [createdAsset] = await testDb.insert(assets).values({
        sourceUri: 'test://ltree/manipulation',
        contentHash: 'ltreemanipulationhash',
        path: 'Root.Level1.Level2.Level3',
      }).returning();

      // Test subpath extraction
      const pathManipulation = await testSql`
        SELECT 
          path::text as full_path,
          subpath(path, 0, 2)::text as first_two,
          subpath(path, 1)::text as from_second,
          nlevel(path) as depth,
          index(path, 'Level2') as level2_index
        FROM assets 
        WHERE id = ${createdAsset.id}
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
      // Create an asset first
      const [parentAsset] = await testDb.insert(assets).values({
        sourceUri: 'test://vector/parent',
        contentHash: 'vectorparenthash',
        path: 'Test.Vector.Parent',
      }).returning();

      // Create nodes with embeddings
      const embedding1 = createTestEmbedding(0); // 1536-dimensional vector
      const embedding2 = createTestEmbedding(1); // 1536-dimensional vector

      const [node1, node2] = await testDb.insert(nodes).values([
        {
          assetId: parentAsset.id,
          content: 'First chunk with embedding',
          embedding: embedding1,
        },
        {
          assetId: parentAsset.id,
          content: 'Second chunk with embedding', 
          embedding: embedding2,
        },
      ]).returning();

      // Retrieve and verify embeddings
      const retrievedNodes = await testDb.select().from(nodes)
        .where(eq(nodes.assetId, parentAsset.id))
        .orderBy(nodes.createdAt);

      expect(retrievedNodes).toHaveLength(2);
      expect(retrievedNodes[0].embedding).toEqual(embedding1);
      expect(retrievedNodes[1].embedding).toEqual(embedding2);
    });

    it('should perform vector similarity searches', async () => {
      // Create an asset first
      const [parentAsset] = await testDb.insert(assets).values({
        sourceUri: 'test://vector/similarity',
        contentHash: 'vectorsimilarityhash',
        path: 'Test.Vector.Similarity',
      }).returning();

      // Create nodes with different embeddings
      const baseEmbedding = createTestEmbedding(0); // 1536-dimensional vector
      const similarEmbedding = createTestEmbedding(0.01); // Similar to base
      const differentEmbedding = createTestEmbedding(10); // Very different

      await testDb.insert(nodes).values([
        {
          assetId: parentAsset.id,
          content: 'Base content',
          embedding: baseEmbedding,
        },
        {
          assetId: parentAsset.id,
          content: 'Similar content',
          embedding: similarEmbedding,
        },
        {
          assetId: parentAsset.id,
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
        FROM nodes 
        WHERE asset_id = ${parentAsset.id}
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
      // Create an asset first
      const [parentAsset] = await testDb.insert(assets).values({
        sourceUri: 'test://vector/null',
        contentHash: 'vectornullhash',
        path: 'Test.Vector.Null',
      }).returning();

      // Create a node with null embedding
      await testDb.insert(nodes).values({
        assetId: parentAsset.id,
        content: 'Chunk without embedding',
        embedding: null,
      });

      // Retrieve and verify
      const retrievedNode = await testDb.select().from(nodes)
        .where(eq(nodes.assetId, parentAsset.id))
        .then(results => results[0]);

      expect(retrievedNode.content).toBe('Chunk without embedding');
      expect(retrievedNode.embedding).toBeNull();
    });

    it('should validate vector dimensions', async () => {
      // Create an asset first
      const [parentAsset] = await testDb.insert(assets).values({
        sourceUri: 'test://vector/dimensions',
        contentHash: 'vectordimensionshash',
        path: 'Test.Vector.Dimensions',
      }).returning();

      // Create a vector with correct dimensions
      const correctEmbedding = createTestEmbedding(0);

      // Create a vector with incorrect dimensions
      const incorrectEmbedding = [0.1, 0.2, 0.3]; // Only 3 dimensions

      // Correct dimensions should work
      await expect(
        testDb.insert(nodes).values({
          assetId: parentAsset.id,
          content: 'Chunk with correct embedding size',
          embedding: correctEmbedding,
        })
      ).resolves.toBeDefined();

      // Incorrect dimensions should fail
      await expect(
        testDb.insert(nodes).values({
          assetId: parentAsset.id,
          content: 'Chunk with incorrect embedding size',
          embedding: incorrectEmbedding,
        })
      ).rejects.toThrow(/expected 1536 dimensions/);
    });
  });

  describe('JSONB metadata', () => {
    it('should store and query complex JSON metadata', async () => {
      const complexMetadata = {
        author: {
          name: 'Jane Smith',
          email: 'jane@example.com',
          profile: {
            age: 32,
            interests: ['AI', 'Machine Learning', 'Data Science']
          }
        },
        stats: {
          views: 1250,
          likes: 42,
          shares: 15
        },
        tags: ['research', 'ai', 'academic']
      };

      // Insert asset with complex metadata
      const [asset] = await testDb.insert(assets).values({
        sourceUri: 'test://jsonb/complex',
        contentHash: 'jsonbcomplex123hash',
        path: 'Test.JSONB.Complex',
        metadata: complexMetadata
      }).returning();

      // Retrieve the asset with metadata
      const retrievedAsset = await testSql`
        SELECT * FROM assets WHERE id = ${asset.id}
      `.then(results => results[0]);

      // PostgreSQL might return JSON as a string, so we need to parse it if it's a string
      const retrievedMetadata = typeof retrievedAsset.metadata === 'string' 
        ? JSON.parse(retrievedAsset.metadata) 
        : retrievedAsset.metadata;
        
      expect(retrievedMetadata).toEqual(complexMetadata);

      // Test JSONB path queries
      const authorNameResult = await testSql`
        SELECT metadata->'author'->>'name' as author_name
        FROM assets
        WHERE id = ${asset.id}
      `;
      expect(authorNameResult[0].author_name).toBe('Jane Smith');

      // Test JSONB array element access
      const secondInterestResult = await testSql`
        SELECT metadata->'author'->'profile'->'interests'->1 as second_interest
        FROM assets
        WHERE id = ${asset.id}
      `;
      expect(secondInterestResult[0].second_interest).toBe('"Machine Learning"');
    });

    it('should support JSONB containment queries', async () => {
      // Insert assets with different metadata
      await testDb.insert(assets).values([
        {
          sourceUri: 'test://jsonb/contain1',
          contentHash: 'jsonbcontain1hash',
          path: 'Test.JSONB.Contain1',
          metadata: {
            topics: ['ai', 'machine learning'],
            type: 'article'
          }
        },
        {
          sourceUri: 'test://jsonb/contain2',
          contentHash: 'jsonbcontain2hash',
          path: 'Test.JSONB.Contain2',
          metadata: {
            topics: ['ai', 'robotics'],
            type: 'video'
          }
        },
        {
          sourceUri: 'test://jsonb/contain3',
          contentHash: 'jsonbcontain3hash',
          path: 'Test.JSONB.Contain3',
          metadata: {
            topics: ['database', 'sql'],
            type: 'tutorial'
          }
        }
      ]);

      // Query for assets that have 'ai' in their topics array
      const aiAssets = await testSql`
        SELECT source_uri FROM assets
        WHERE metadata @> '{"topics": ["ai"]}'::jsonb
        ORDER BY source_uri
      `;

      expect(aiAssets).toHaveLength(2);
      expect(aiAssets.map(item => item.source_uri)).toEqual([
        'test://jsonb/contain1',
        'test://jsonb/contain2'
      ]);

      // Query for assets of type 'article'
      const articleAssets = await testSql`
        SELECT source_uri FROM assets
        WHERE metadata->>'type' = 'article'
      `;

      expect(articleAssets).toHaveLength(1);
      expect(articleAssets[0].source_uri).toBe('test://jsonb/contain1');
    });
  });
}); 