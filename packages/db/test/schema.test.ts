import { describe, it, expect } from 'vitest';
import { testDb } from './setup';
import { items, chunks, tags, itemTags } from '../schema';
import { eq, and } from 'drizzle-orm';

describe('CRUD Operations', () => {
  describe('Items', () => {
    it('should create and retrieve an item', async () => {
      const newItem = {
        sourceUri: 'test://example/item1',
        canonicalUri: 'https://example.com/item1',
        contentHash: 'abc123hash',
        path: 'Test.Example.Item1',
        sourceName: 'test',
        title: 'Test Item 1',
        displayContent: 'This is a test item for testing purposes',
        rawContent: { type: 'test', data: 'raw content' },
        metadata: { tags: ['test', 'example'], priority: 'high' },
        itemTimestamp: new Date('2023-01-01T00:00:00Z'),
      };

      // Create item
      const [createdItem] = await testDb.insert(items).values(newItem).returning();
      
      expect(createdItem).toMatchObject({
        sourceUri: newItem.sourceUri,
        canonicalUri: newItem.canonicalUri,
        contentHash: newItem.contentHash,
        path: newItem.path,
        sourceName: newItem.sourceName,
        title: newItem.title,
        displayContent: newItem.displayContent,
      });
      expect(createdItem.id).toBeDefined();
      expect(createdItem.createdAt).toBeInstanceOf(Date);
      expect(createdItem.updatedAt).toBeInstanceOf(Date);

      // Retrieve item
      const retrievedItem = await testDb.query.items.findFirst({
        where: eq(items.id, createdItem.id),
      });

      expect(retrievedItem).toMatchObject(createdItem);
    });

    it('should enforce unique constraints', async () => {
      const item1 = {
        sourceUri: 'test://example/unique1',
        contentHash: 'unique123hash',
        path: 'Test.Unique.Item1',
        sourceName: 'test',
      };

      // Create first item successfully
      await testDb.insert(items).values(item1);

      // Try to create item with same sourceUri - should fail
      await expect(
        testDb.insert(items).values({ ...item1, sourceUri: 'test://example/unique1' })
      ).rejects.toThrow();

      // Try to create item with same contentHash - should fail
      await expect(
        testDb.insert(items).values({ ...item1, sourceUri: 'test://example/unique2' })
      ).rejects.toThrow();
    });

    it('should update an item', async () => {
      const newItem = {
        sourceUri: 'test://example/update1',
        contentHash: 'update123hash',
        path: 'Test.Update.Item1',
        sourceName: 'test',
        title: 'Original Title',
      };

      const [createdItem] = await testDb.insert(items).values(newItem).returning();

      // Update the item
      const [updatedItem] = await testDb
        .update(items)
        .set({ 
          title: 'Updated Title',
          displayContent: 'Updated content',
          updatedAt: new Date(),
        })
        .where(eq(items.id, createdItem.id))
        .returning();

      expect(updatedItem.title).toBe('Updated Title');
      expect(updatedItem.displayContent).toBe('Updated content');
      expect(updatedItem.updatedAt.getTime()).toBeGreaterThan(createdItem.updatedAt.getTime());
    });

    it('should delete an item', async () => {
      const newItem = {
        sourceUri: 'test://example/delete1',
        contentHash: 'delete123hash',
        path: 'Test.Delete.Item1',
        sourceName: 'test',
      };

      const [createdItem] = await testDb.insert(items).values(newItem).returning();

      // Delete the item
      await testDb.delete(items).where(eq(items.id, createdItem.id));

      // Verify it's deleted
      const retrievedItem = await testDb.query.items.findFirst({
        where: eq(items.id, createdItem.id),
      });

      expect(retrievedItem).toBeUndefined();
    });
  });

  describe('Chunks', () => {
    it('should create and retrieve chunks for an item', async () => {
      // First create an item
      const [parentItem] = await testDb.insert(items).values({
        sourceUri: 'test://example/chunk-parent',
        contentHash: 'chunkparent123hash',
        path: 'Test.Chunks.Parent',
        sourceName: 'test',
      }).returning();

      // Create chunks
      const chunk1 = {
        itemId: parentItem.id,
        content: 'This is the first chunk of content',
        embedding: [0.1, 0.2, 0.3, 0.4, 0.5], // Small vector for testing
        metadata: { chunkIndex: 0, page: 1 },
      };

      const chunk2 = {
        itemId: parentItem.id,
        content: 'This is the second chunk of content',
        embedding: [0.6, 0.7, 0.8, 0.9, 1.0],
        metadata: { chunkIndex: 1, page: 1 },
      };

      const createdChunks = await testDb.insert(chunks).values([chunk1, chunk2]).returning();

      expect(createdChunks).toHaveLength(2);
      expect(createdChunks[0].content).toBe(chunk1.content);
      expect(createdChunks[1].content).toBe(chunk2.content);

      // Retrieve chunks for the item
      const retrievedChunks = await testDb.query.chunks.findMany({
        where: eq(chunks.itemId, parentItem.id),
        orderBy: (chunks, { asc }) => [asc(chunks.createdAt)],
      });

      expect(retrievedChunks).toHaveLength(2);
      expect(retrievedChunks[0].content).toBe(chunk1.content);
      expect(retrievedChunks[1].content).toBe(chunk2.content);
    });

    it('should cascade delete chunks when item is deleted', async () => {
      // Create item and chunk
      const [parentItem] = await testDb.insert(items).values({
        sourceUri: 'test://example/cascade-delete',
        contentHash: 'cascadedelete123hash',
        path: 'Test.Cascade.Delete',
        sourceName: 'test',
      }).returning();

      const [createdChunk] = await testDb.insert(chunks).values({
        itemId: parentItem.id,
        content: 'This chunk should be deleted when item is deleted',
      }).returning();

      // Delete the parent item
      await testDb.delete(items).where(eq(items.id, parentItem.id));

      // Verify the chunk was also deleted
      const retrievedChunk = await testDb.query.chunks.findFirst({
        where: eq(chunks.id, createdChunk.id),
      });

      expect(retrievedChunk).toBeUndefined();
    });
  });

  describe('Tags and ItemTags', () => {
    it('should create tags and associate them with items', async () => {
      // Create an item
      const [parentItem] = await testDb.insert(items).values({
        sourceUri: 'test://example/tags-test',
        contentHash: 'tagstest123hash',
        path: 'Test.Tags.Item',
        sourceName: 'test',
      }).returning();

      // Create tags
      const [tag1] = await testDb.insert(tags).values({ name: 'ai' }).returning();
      const [tag2] = await testDb.insert(tags).values({ name: 'machine-learning' }).returning();

      // Associate tags with item
      await testDb.insert(itemTags).values([
        { itemId: parentItem.id, tagId: tag1.id },
        { itemId: parentItem.id, tagId: tag2.id },
      ]);

      // Retrieve item with tags
      const itemWithTags = await testDb.query.items.findFirst({
        where: eq(items.id, parentItem.id),
        with: {
          itemTags: {
            with: {
              tag: true,
            },
          },
        },
      });

      expect(itemWithTags?.itemTags).toHaveLength(2);
      const tagNames = itemWithTags?.itemTags.map(it => it.tag.name).sort();
      expect(tagNames).toEqual(['ai', 'machine-learning']);
    });

    it('should prevent duplicate tag names', async () => {
      // Create first tag
      await testDb.insert(tags).values({ name: 'duplicate-test' });

      // Try to create duplicate tag - should fail
      await expect(
        testDb.insert(tags).values({ name: 'duplicate-test' })
      ).rejects.toThrow();
    });

    it('should cascade delete item-tag associations when item is deleted', async () => {
      // Create item and tag
      const [parentItem] = await testDb.insert(items).values({
        sourceUri: 'test://example/tag-cascade',
        contentHash: 'tagcascade123hash',
        path: 'Test.TagCascade.Item',
        sourceName: 'test',
      }).returning();

      const [tag] = await testDb.insert(tags).values({ name: 'cascade-tag' }).returning();

      // Associate tag with item
      await testDb.insert(itemTags).values({
        itemId: parentItem.id,
        tagId: tag.id,
      });

      // Delete the item
      await testDb.delete(items).where(eq(items.id, parentItem.id));

      // Verify the association was deleted
      const association = await testDb.query.itemTags.findFirst({
        where: and(
          eq(itemTags.itemId, parentItem.id),
          eq(itemTags.tagId, tag.id)
        ),
      });

      expect(association).toBeUndefined();

      // Verify the tag still exists
      const retrievedTag = await testDb.query.tags.findFirst({
        where: eq(tags.id, tag.id),
      });

      expect(retrievedTag).toBeDefined();
    });
  });
}); 