import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { db } from '../client';
import { sources, nodes, tags, nodeTags } from '../schema';
import { batchImport } from '../import-example';
import { sql } from 'drizzle-orm';

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

describe('Batch Import Tests', () => {
  it('should batch import multiple content types', async () => {
    // Arrange
    const batchData = [
      {
        type: 'youtube' as const,
        data: {
          videoId: 'batch123',
          channelId: 'channel456',
          title: 'Batch Test Video',
          channelName: 'Test Channel',
          transcript: 'This is a test transcript for batch import.',
          metadata: {
            publishedAt: '2023-01-01T12:00:00Z',
            duration: '05:30'
          }
        }
      },
      {
        type: 'twitter' as const,
        data: {
          tweets: [
            {
              id: 'batchtweet1',
              author: 'batchuser',
              content: 'This is a batch imported tweet.',
              createdAt: '2023-04-05T10:00:00Z',
              metadata: {
                likeCount: 25,
                retweetCount: 5
              }
            }
          ]
        }
      }
    ];

    // Act
    const results = await batchImport(batchData);

    // Assert
    expect(results.length).toBe(2);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(true);
    
    // Check that sources were created
    const allSources = await db.query.sources.findMany();
    expect(allSources.length).toBe(2);
    
    // Check YouTube source
    const youtubeSource = allSources.find(s => 
      s.sourceUri.includes('youtube.com')
    );
    expect(youtubeSource).toBeDefined();
    
    // Check Twitter source
    const twitterSource = allSources.find(s => 
      s.sourceUri.includes('twitter.com')
    );
    expect(twitterSource).toBeDefined();
    
    // Check that nodes were created
    const allNodes = await db.query.nodes.findMany();
    expect(allNodes.length).toBeGreaterThan(2); // At least one node per source
  });

  it('should handle errors in batch import gracefully', async () => {
    // Arrange
    const batchData = [
      {
        type: 'youtube' as const,
        data: {
          videoId: 'success123',
          channelId: 'channel456',
          title: 'Success Video',
          channelName: 'Test Channel',
          transcript: 'This should import successfully.',
          metadata: {
            publishedAt: '2023-01-01T12:00:00Z'
          }
        }
      },
      {
        type: 'youtube' as const,
        data: {
          // Missing required fields to cause an error
          videoId: 'error123'
          // No title, channelName, transcript, etc.
        }
      }
    ];

    // Act
    const results = await batchImport(batchData);

    // Assert
    expect(results.length).toBe(2);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(false);
    expect(results[1].error).toBeDefined();
    
    // Check that only one source was created
    const allSources = await db.query.sources.findMany();
    expect(allSources.length).toBe(1);
    expect(allSources[0].sourceUri).toContain('success123');
  });

  it('should create proper hierarchical node relationships', async () => {
    // Arrange
    const redditData = {
      type: 'reddit' as const,
      data: {
        postId: 'hierarchy123',
        subreddit: 'testsubreddit',
        title: 'Test Hierarchy',
        content: 'This is a test of hierarchical relationships.',
        author: 'testuser',
        comments: [
          {
            id: 'parent1',
            author: 'user1',
            content: 'Parent comment.',
            depth: 0
          },
          {
            id: 'child1',
            author: 'user2',
            content: 'Child comment 1.',
            parentId: 'parent1',
            depth: 1
          },
          {
            id: 'grandchild1',
            author: 'user3',
            content: 'Grandchild comment.',
            parentId: 'child1',
            depth: 2
          }
        ],
        metadata: {
          postedAt: '2023-03-10T09:15:00Z'
        }
      }
    };

    // Act
    const results = await batchImport([redditData]);

    // Assert
    expect(results[0].success).toBe(true);
    
    // Get the source
    const source = await db.query.sources.findFirst({
      where: (sources, { like }) => like(sources.sourceUri, '%hierarchy123%')
    });
    expect(source).toBeDefined();
    
    if (source) {
      // Get all nodes for this source
      const allNodes = await db.query.nodes.findMany({
        where: (nodes, { eq }) => eq(nodes.sourceId, source.id)
      });
      
      // Should have 4 nodes: root + 3 comments
      expect(allNodes.length).toBe(4);
      
      // Check depth distribution
      const depthCounts = allNodes.reduce((acc, node) => {
        acc[node.depth] = (acc[node.depth] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);
      
      // Should have 1 node at depth 0, 1 at depth 1, 1 at depth 2, and 1 at depth 3
      expect(depthCounts[0]).toBe(1); // Root node
      expect(depthCounts[1]).toBe(1); // Parent comment
      expect(depthCounts[2]).toBe(1); // Child comment
      expect(depthCounts[3]).toBe(1); // Grandchild comment
    }
  });
}); 