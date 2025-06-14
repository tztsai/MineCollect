import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { db } from '../client';
import { sources, nodes, tags, nodeTags } from '../schema';
import { importYouTubeVideo, importRedditPost } from '../import-example';
import { eq, and, sql } from 'drizzle-orm';

// Test database setup and teardown
beforeAll(async () => {
  // Ensure we're using a test database
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS ltree`);
});

afterAll(async () => {
  // Clean up after tests
  await db.delete(nodeTags);
  await db.delete(tags);
  await db.delete(nodes);
  await db.delete(sources);
});

beforeEach(async () => {
  // Clean up before each test
  await db.delete(nodeTags);
  await db.delete(tags);
  await db.delete(nodes);
  await db.delete(sources);
});

describe('CRUD Operations on Imported Content', () => {
  describe('Reading Operations', () => {
    it('should retrieve imported content with related nodes', async () => {
      // Arrange - import a YouTube video
      const videoData = {
        videoId: 'read123',
        channelId: 'channel456',
        title: 'Test Reading',
        channelName: 'Test Channel',
        transcript: 'This is a test transcript for reading operations.',
        metadata: {
          publishedAt: '2023-01-01T12:00:00Z',
          duration: '05:30'
        }
      };
      
      const source = await importYouTubeVideo(videoData);
      
      // Act - retrieve the source with its nodes
      const retrievedSource = await db.query.sources.findFirst({
        where: (sources, { eq }) => eq(sources.id, source.id),
        with: {
          nodes: true
        }
      });
      
      // Assert
      expect(retrievedSource).toBeDefined();
      expect(retrievedSource?.sourceUri).toBe(`https://www.youtube.com/watch?v=${videoData.videoId}`);
      expect(retrievedSource?.nodes.length).toBeGreaterThan(0);
      
      // Check that we can query nodes directly
      const nodes = await db.query.nodes.findMany({
        where: (nodes, { eq }) => eq(nodes.sourceId, source.id),
        orderBy: (nodes, { asc }) => [asc(nodes.depth)]
      });
      
      expect(nodes.length).toBeGreaterThan(0);
      expect(nodes[0].title).toBe(videoData.title);
    });
    
    it('should query content by path using ltree operations', async () => {
      // Arrange - import a Reddit post
      const postData = {
        postId: 'path123',
        subreddit: 'testsubreddit',
        title: 'Test Path Queries',
        content: 'This is a test for path queries.',
        author: 'testuser',
        comments: [
          {
            id: 'comment1',
            author: 'user1',
            content: 'Comment for path testing.',
            depth: 0
          }
        ],
        metadata: {
          postedAt: '2023-03-10T09:15:00Z'
        }
      };
      
      await importRedditPost(postData);
      
      // Act - query by path pattern
      const socialNodes = await db.execute(
        sql`SELECT * FROM nodes WHERE path ~ 'Social.*'`
      );
      
      const redditNodes = await db.execute(
        sql`SELECT * FROM nodes WHERE path ~ 'Social.Reddit.*'`
      );
      
      // Assert
      expect(socialNodes.length).toBeGreaterThan(0);
      expect(redditNodes.length).toBeGreaterThan(0);
      expect(socialNodes.length).toBeGreaterThanOrEqual(redditNodes.length);
    });
  });
  
  describe('Update Operations', () => {
    it('should update source metadata', async () => {
      // Arrange - import a YouTube video
      const videoData = {
        videoId: 'update123',
        channelId: 'channel456',
        title: 'Test Update',
        channelName: 'Test Channel',
        transcript: 'This is a test transcript for update operations.',
        metadata: {
          publishedAt: '2023-01-01T12:00:00Z',
          viewCount: 1000
        }
      };
      
      const source = await importYouTubeVideo(videoData);
      
      // Act - update the metadata
      await db.update(sources)
        .set({ 
          metadata: {
            ...source.metadata,
            viewCount: 2000,
            updated: true
          }
        })
        .where(eq(sources.id, source.id));
      
      // Retrieve the updated source
      const updatedSource = await db.query.sources.findFirst({
        where: (sources, { eq }) => eq(sources.id, source.id)
      });
      
      // Assert
      expect(updatedSource).toBeDefined();
      expect(updatedSource?.metadata).toHaveProperty('viewCount', 2000);
      expect(updatedSource?.metadata).toHaveProperty('updated', true);
    });
    
    it('should update node content and metadata', async () => {
      // Arrange - import a YouTube video
      const videoData = {
        videoId: 'nodeupdate123',
        channelId: 'channel456',
        title: 'Test Node Update',
        channelName: 'Test Channel',
        transcript: 'This is a test transcript for node update operations.',
        metadata: {
          publishedAt: '2023-01-01T12:00:00Z'
        }
      };
      
      const source = await importYouTubeVideo(videoData);
      
      // Get the root node
      const rootNode = await db.query.nodes.findFirst({
        where: (nodes, { eq, and }) => and(
          eq(nodes.sourceId, source.id),
          eq(nodes.depth, 0)
        )
      });
      
      expect(rootNode).toBeDefined();
      
      if (rootNode) {
        // Act - update the node
        await db.update(nodes)
          .set({ 
            title: 'Updated Title',
            content: 'Updated content for testing',
            metadata: {
              ...rootNode.metadata,
              updated: true
            }
          })
          .where(eq(nodes.id, rootNode.id));
        
        // Retrieve the updated node
        const updatedNode = await db.query.nodes.findFirst({
          where: (nodes, { eq }) => eq(nodes.id, rootNode.id)
        });
        
        // Assert
        expect(updatedNode).toBeDefined();
        expect(updatedNode?.title).toBe('Updated Title');
        expect(updatedNode?.content).toBe('Updated content for testing');
        expect(updatedNode?.metadata).toHaveProperty('updated', true);
      }
    });
  });
  
  describe('Delete Operations', () => {
    it('should soft delete a node by marking it inactive', async () => {
      // Arrange - import a YouTube video
      const videoData = {
        videoId: 'softdelete123',
        channelId: 'channel456',
        title: 'Test Soft Delete',
        channelName: 'Test Channel',
        transcript: 'This is a test transcript for soft delete operations.',
        metadata: {
          publishedAt: '2023-01-01T12:00:00Z'
        }
      };
      
      const source = await importYouTubeVideo(videoData);
      
      // Get all nodes for this source
      const allNodes = await db.query.nodes.findMany({
        where: (nodes, { eq }) => eq(nodes.sourceId, source.id)
      });
      
      const nodeToSoftDelete = allNodes.find(node => node.depth === 1);
      expect(nodeToSoftDelete).toBeDefined();
      
      if (nodeToSoftDelete) {
        // Act - soft delete the node
        await db.update(nodes)
          .set({ isActive: false })
          .where(eq(nodes.id, nodeToSoftDelete.id));
        
        // Retrieve all active nodes
        const activeNodes = await db.query.nodes.findMany({
          where: (nodes, { eq, and }) => and(
            eq(nodes.sourceId, source.id),
            eq(nodes.isActive, true)
          )
        });
        
        // Retrieve the soft-deleted node
        const softDeletedNode = await db.query.nodes.findFirst({
          where: (nodes, { eq }) => eq(nodes.id, nodeToSoftDelete.id)
        });
        
        // Assert
        expect(activeNodes.length).toBe(allNodes.length - 1);
        expect(softDeletedNode).toBeDefined();
        expect(softDeletedNode?.isActive).toBe(false);
      }
    });
    
    it('should hard delete a source and cascade to its nodes', async () => {
      // Arrange - import a YouTube video
      const videoData = {
        videoId: 'harddelete123',
        channelId: 'channel456',
        title: 'Test Hard Delete',
        channelName: 'Test Channel',
        transcript: 'This is a test transcript for hard delete operations.',
        metadata: {
          publishedAt: '2023-01-01T12:00:00Z'
        }
      };
      
      const source = await importYouTubeVideo(videoData);
      
      // Get count of nodes for this source
      const nodesBefore = await db.query.nodes.findMany({
        where: (nodes, { eq }) => eq(nodes.sourceId, source.id)
      });
      
      expect(nodesBefore.length).toBeGreaterThan(0);
      
      // Act - hard delete the source
      await db.delete(sources)
        .where(eq(sources.id, source.id));
      
      // Try to retrieve the source
      const deletedSource = await db.query.sources.findFirst({
        where: (sources, { eq }) => eq(sources.id, source.id)
      });
      
      // Try to retrieve nodes for the deleted source
      const nodesAfter = await db.query.nodes.findMany({
        where: (nodes, { eq }) => eq(nodes.sourceId, source.id)
      });
      
      // Assert
      expect(deletedSource).toBeNull();
      expect(nodesAfter.length).toBe(0); // All nodes should be deleted due to cascade
    });
  });
}); 