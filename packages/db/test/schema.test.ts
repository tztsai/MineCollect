import { describe, it, expect } from 'vitest';
import { testDb } from './setup';
import { assets, nodes, tags, assetTags } from '../schema';
import { eq, and } from 'drizzle-orm';
import { testSql } from './setup';

// Create a 1536-dimensional vector for testing
function createTestEmbedding(seed: number): number[] {
  return Array.from({ length: 1536 }, (_, i) => (seed + i) * 0.01);
}

describe('CRUD Operations', () => {
  describe('Assets', () => {
    it('should create and retrieve an asset', async () => {
      const newAsset = {
        sourceUri: 'test://example/asset1',
        webUrl: 'https://example.com/asset1',
        contentHash: 'abc123hash',
        path: 'Test.Example.Asset1',
        metadata: { tags: ['test', 'example'], priority: 'high' },
        timestamp: new Date('2023-01-01T00:00:00Z'),
      };

      // Create asset
      const [createdAsset] = await testDb.insert(assets).values(newAsset).returning();
      
      expect(createdAsset).toMatchObject({
        sourceUri: newAsset.sourceUri,
        webUrl: newAsset.webUrl,
        contentHash: newAsset.contentHash,
        path: newAsset.path,
      });
      expect(createdAsset.id).toBeDefined();

      // Retrieve asset
      const retrievedAsset = await testDb.select().from(assets)
        .where(eq(assets.id, createdAsset.id))
        .then(results => results[0]);

      expect(retrievedAsset).toMatchObject(createdAsset);
    });

    it('should enforce unique constraints', async () => {
      const asset1 = {
        sourceUri: 'test://example/unique1',
        contentHash: 'unique123hash',
        path: 'Test.Unique.Asset1',
      };

      // Create first asset successfully
      await testDb.insert(assets).values(asset1);

      // Try to create asset with same sourceUri - should fail
      await expect(
        testDb.insert(assets).values({ ...asset1, sourceUri: 'test://example/unique1' })
      ).rejects.toThrow();

      // Try to create asset with same contentHash - should fail
      await expect(
        testDb.insert(assets).values({ ...asset1, sourceUri: 'test://example/unique2' })
      ).rejects.toThrow();
    });

    it('should update an asset', async () => {
      const newAsset = {
        sourceUri: 'test://example/update1',
        contentHash: 'update123hash',
        path: 'Test.Update.Asset1',
        metadata: { original: true },
      };

      const [createdAsset] = await testDb.insert(assets).values(newAsset).returning();

      // Update the asset
      const [updatedAsset] = await testDb
        .update(assets)
        .set({ 
          webUrl: 'https://example.com/updated',
          metadata: { updated: true },
        })
        .where(eq(assets.id, createdAsset.id))
        .returning();

      expect(updatedAsset.webUrl).toBe('https://example.com/updated');
      expect(updatedAsset.metadata).toEqual({ updated: true });
    });

    it('should delete an asset', async () => {
      const newAsset = {
        sourceUri: 'test://example/delete1',
        contentHash: 'delete123hash',
        path: 'Test.Delete.Asset1',
      };

      const [createdAsset] = await testDb.insert(assets).values(newAsset).returning();

      // Delete the asset
      await testDb.delete(assets).where(eq(assets.id, createdAsset.id));

      // Verify it's deleted
      const retrievedAsset = await testDb.select().from(assets)
        .where(eq(assets.id, createdAsset.id))
        .then(results => results[0]);

      expect(retrievedAsset).toBeUndefined();
    });
  });

  describe('Nodes', () => {
    it('should create and retrieve nodes for an asset', async () => {
      // First create an asset
      const [parentAsset] = await testDb.insert(assets).values({
        sourceUri: 'test://example/node-parent',
        contentHash: 'nodeparent123hash',
        path: 'Test.Nodes.Parent',
      }).returning();

      // Create root node
      const [rootNode] = await testDb.insert(nodes).values({
        assetId: parentAsset.id,
        title: 'Root Node',
        content: 'This is the root node content',
        embedding: createTestEmbedding(1), // Use 1536-dimensional vector
        metadata: { nodeType: 'root' },
      }).returning();

      // Create child node
      const [childNode] = await testDb.insert(nodes).values({
        assetId: parentAsset.id,
        parentId: rootNode.id,
        title: 'Child Node',
        content: 'This is a child node content',
        embedding: createTestEmbedding(2), // Use 1536-dimensional vector
        metadata: { nodeType: 'child' },
      }).returning();

      // Update asset with root node reference
      await testDb.update(assets)
        .set({ rootNodeId: rootNode.id })
        .where(eq(assets.id, parentAsset.id));

      // Retrieve nodes for the asset
      const retrievedNodes = await testDb.select().from(nodes)
        .where(eq(nodes.assetId, parentAsset.id))
        .orderBy(nodes.createdAt);

      expect(retrievedNodes).toHaveLength(2);
      expect(retrievedNodes[0].title).toBe('Root Node');
      expect(retrievedNodes[1].title).toBe('Child Node');
      expect(retrievedNodes[1].parentId).toBe(rootNode.id);

      // Test node tree structure
      const childNodes = await testDb.select().from(nodes)
        .where(eq(nodes.parentId, rootNode.id));

      expect(childNodes).toHaveLength(1);
      expect(childNodes[0].id).toBe(childNode.id);
    });

    it('should cascade delete nodes when asset is deleted', async () => {
      // Create asset and node
      const [parentAsset] = await testDb.insert(assets).values({
        sourceUri: 'test://example/cascade-delete',
        contentHash: 'cascadedelete123hash',
        path: 'Test.Cascade.Delete',
      }).returning();

      const [createdNode] = await testDb.insert(nodes).values({
        assetId: parentAsset.id,
        content: 'This node should be deleted when asset is deleted',
      }).returning();

      // Delete the parent asset
      await testDb.delete(assets).where(eq(assets.id, parentAsset.id));

      // Verify the node was also deleted
      const retrievedNode = await testDb.select().from(nodes)
        .where(eq(nodes.id, createdNode.id))
        .then(results => results[0]);

      expect(retrievedNode).toBeUndefined();
    });
  });

  describe('Tags and AssetTags', () => {
    it('should create tags and associate them with assets', async () => {
      // Create an asset
      const [parentAsset] = await testDb.insert(assets).values({
        sourceUri: 'test://example/tags-test',
        contentHash: 'tagstest123hash',
        path: 'Test.Tags.Asset',
      }).returning();

      // Create tags
      const [tag1] = await testDb.insert(tags).values({ 
        name: 'ai',
      }).returning();
      
      const [tag2] = await testDb.insert(tags).values({ 
        name: 'machine-learning',
      }).returning();

      // Associate tags with asset
      await testDb.insert(assetTags).values([
        { assetId: parentAsset.id, tagId: tag1.id },
        { assetId: parentAsset.id, tagId: tag2.id },
      ]);

      // Query to get all tags for the asset
      const tagResults = await testSql`
        SELECT t.* FROM tags t
        JOIN asset_tags at ON t.id = at.tag_id
        WHERE at.asset_id = ${parentAsset.id}
        ORDER BY t.name
      `;
      
      const tagNames = tagResults.map(t => t.name).sort();
      expect(tagNames).toEqual(['ai', 'machine-learning']);
    });

    it('should prevent duplicate tag names', async () => {
      // Create a tag
      await testDb.insert(tags).values({ 
        name: 'duplicate-test',
      });

      // Try to create another tag with the same name
      await expect(
        testDb.insert(tags).values({
          name: 'duplicate-test',
        })
      ).rejects.toThrow();
    });

    it('should create hierarchical tag structure', async () => {
      // Create parent tag
      const [parentTag] = await testDb.insert(tags).values({ 
        name: 'programming',
      }).returning();

      // Create child tags
      const [childTag1] = await testDb.insert(tags).values({ 
        name: 'javascript',
        parentId: parentTag.id,
      }).returning();

      const [childTag2] = await testDb.insert(tags).values({ 
        name: 'python',
        parentId: parentTag.id,
      }).returning();

      // Create grandchild tag
      const [grandchildTag] = await testDb.insert(tags).values({ 
        name: 'react',
        parentId: childTag1.id,
      }).returning();

      // Query to get all descendants of the parent tag
      const descendants = await testSql`
        WITH RECURSIVE tag_tree AS (
          SELECT id, name, parent_id FROM tags WHERE id = ${parentTag.id}
          UNION ALL
          SELECT t.id, t.name, t.parent_id FROM tags t
          JOIN tag_tree tt ON t.parent_id = tt.id
        )
        SELECT * FROM tag_tree WHERE id != ${parentTag.id}
      `;

      expect(descendants).toHaveLength(3);
      expect(descendants.map(d => d.name).sort()).toEqual(['javascript', 'python', 'react']);
    });

    it('should cascade delete asset-tag associations when asset is deleted', async () => {
      // Create an asset
      const [testAsset] = await testDb.insert(assets).values({
        sourceUri: 'test://example/cascade-tags-schema-test',
        contentHash: 'cascadetags123hash-schema-unique',
        path: 'Test.Cascade.Tags',
      }).returning();

      // Create a tag
      const [testTag] = await testDb.insert(tags).values({ 
        name: 'test-cascade-schema',
      }).returning();

      // Associate tag with asset
      await testDb.insert(assetTags).values({
        assetId: testAsset.id,
        tagId: testTag.id,
      });

      // Verify the association exists
      let associations = await testSql`
        SELECT * FROM asset_tags WHERE asset_id = ${testAsset.id}
      `;
      expect(associations).toHaveLength(1);

      // Delete the asset
      await testDb.delete(assets).where(eq(assets.id, testAsset.id));

      // Verify the association was deleted
      associations = await testSql`
        SELECT * FROM asset_tags WHERE asset_id = ${testAsset.id}
      `;
      expect(associations).toHaveLength(0);

      // Verify the tag still exists
      const tagExists = await testSql`
        SELECT * FROM tags WHERE id = ${testTag.id}
      `;
      expect(tagExists).toHaveLength(1);
    });
  });
}); 