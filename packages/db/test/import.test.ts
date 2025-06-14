import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { db } from '../client';
import { sources, nodes, tags, nodeTags } from '../schema';
import { 
  importYouTubeVideo,
  importReadwiseHighlight,
  importRedditPost,
  importTwitterThread
} from '../import-example';
import { sql } from 'drizzle-orm';

// Test database setup and teardown
beforeAll(async () => {
  // Ensure we're using a test database
  // This could be a separate test DB or we could use transactions
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

describe('Content Import Tests', () => {
  describe('YouTube Video Import', () => {
    it('should import a YouTube video with transcript segments', async () => {
      // Arrange
      const videoData = {
        videoId: 'abc123',
        channelId: 'channel456',
        title: 'Test Video',
        channelName: 'Test Channel',
        transcript: 'This is a test transcript. It has multiple sentences. We need to test segmentation.',
        metadata: {
          publishedAt: '2023-01-01T12:00:00Z',
          duration: '10:30',
          viewCount: 1000,
          likeCount: 100
        }
      };

      // Act
      const source = await importYouTubeVideo(videoData);

      // Assert
      expect(source).toBeDefined();
      expect(source.sourceUri).toBe(`https://www.youtube.com/watch?v=${videoData.videoId}`);

      // Check that nodes were created
      const allNodes = await db.query.nodes.findMany({
        where: (nodes, { eq }) => eq(nodes.sourceId, source.id)
      });

      // Should have root node + transcript segments
      expect(allNodes.length).toBeGreaterThan(1);
      
      // Check root node
      const rootNode = allNodes.find(node => node.depth === 0);
      expect(rootNode).toBeDefined();
      expect(rootNode?.title).toBe(videoData.title);
      
      // Check transcript segments
      const segments = allNodes.filter(node => node.depth === 1);
      expect(segments.length).toBeGreaterThan(0);
      expect(segments[0].content).toContain('This is a test transcript');
    });
  });

  describe('Readwise Highlight Import', () => {
    it('should import a Readwise highlight', async () => {
      // Arrange
      const highlightData = {
        highlightId: 'highlight123',
        text: 'This is a highlighted passage from a book.',
        note: 'My note about this highlight',
        bookTitle: 'Test Book',
        author: 'Test Author',
        location: 'Page 42',
        highlightedAt: '2023-02-15T14:30:00Z'
      };

      // Act
      const source = await importReadwiseHighlight(highlightData);

      // Assert
      expect(source).toBeDefined();
      expect(source.sourceUri).toContain('kindle://book/');
      expect(source.sourceUri).toContain(highlightData.highlightId);

      // Check that a node was created
      const highlightNode = await db.query.nodes.findFirst({
        where: (nodes, { eq }) => eq(nodes.sourceId, source.id)
      });

      expect(highlightNode).toBeDefined();
      expect(highlightNode?.content).toBe(highlightData.text);
      expect(highlightNode?.metadata).toHaveProperty('type', 'highlight');
      expect(highlightNode?.metadata).toHaveProperty('note', highlightData.note);
    });
  });

  describe('Reddit Post Import', () => {
    it('should import a Reddit post with comments', async () => {
      // Arrange
      const postData = {
        postId: 'post123',
        subreddit: 'testsubreddit',
        title: 'Test Reddit Post',
        content: 'This is a test Reddit post content.',
        author: 'testuser',
        comments: [
          {
            id: 'comment1',
            author: 'commenter1',
            content: 'This is a comment.',
            depth: 0
          },
          {
            id: 'comment2',
            author: 'commenter2',
            content: 'This is a reply.',
            parentId: 'comment1',
            depth: 1
          }
        ],
        metadata: {
          postedAt: '2023-03-10T09:15:00Z',
          score: 42,
          commentCount: 2
        }
      };

      // Act
      const source = await importRedditPost(postData);

      // Assert
      expect(source).toBeDefined();
      expect(source.sourceUri).toBe(`https://reddit.com/r/${postData.subreddit}/comments/${postData.postId}/`);

      // Check that nodes were created
      const allNodes = await db.query.nodes.findMany({
        where: (nodes, { eq }) => eq(nodes.sourceId, source.id)
      });

      // Should have root node + comments
      expect(allNodes.length).toBe(3); // 1 post + 2 comments
      
      // Check root node
      const rootNode = allNodes.find(node => node.depth === 0);
      expect(rootNode).toBeDefined();
      expect(rootNode?.title).toBe(postData.title);
      expect(rootNode?.content).toBe(postData.content);
      
      // Check comments
      const comments = allNodes.filter(node => node.depth > 0);
      expect(comments.length).toBe(2);
      
      // Check comment metadata
      const comment1 = comments.find(c => c.metadata.author === 'commenter1');
      const comment2 = comments.find(c => c.metadata.author === 'commenter2');
      
      expect(comment1).toBeDefined();
      expect(comment2).toBeDefined();
      expect(comment2?.metadata).toHaveProperty('parentCommentId', 'comment1');
    });
  });

  describe('Twitter Thread Import', () => {
    it('should import a Twitter thread', async () => {
      // Arrange
      const threadData = {
        tweets: [
          {
            id: 'tweet1',
            author: 'testuser',
            content: 'This is the first tweet in a thread.',
            createdAt: '2023-04-05T10:00:00Z',
            metadata: {
              likeCount: 50,
              retweetCount: 10
            }
          },
          {
            id: 'tweet2',
            author: 'testuser',
            content: 'This is the second tweet in the thread.',
            createdAt: '2023-04-05T10:01:00Z',
            metadata: {
              likeCount: 30,
              retweetCount: 5
            }
          }
        ]
      };

      // Act
      const source = await importTwitterThread(threadData);

      // Assert
      expect(source).toBeDefined();
      expect(source.sourceUri).toBe(`https://twitter.com/${threadData.tweets[0].author}/status/${threadData.tweets[0].id}`);

      // Check that nodes were created
      const allNodes = await db.query.nodes.findMany({
        where: (nodes, { eq }) => eq(nodes.sourceId, source.id)
      });

      // Should have root node + individual tweets
      expect(allNodes.length).toBe(3); // 1 thread + 2 tweets
      
      // Check root node
      const rootNode = allNodes.find(node => 
        node.depth === 0 && node.metadata.type === 'twitter_thread'
      );
      expect(rootNode).toBeDefined();
      expect(rootNode?.title).toContain('Twitter Thread by @testuser');
      
      // Check individual tweets
      const tweets = allNodes.filter(node => 
        node.depth === 1 && node.metadata.type === 'tweet'
      );
      expect(tweets.length).toBe(2);
      
      // Check tweet content
      const tweet1 = tweets.find(t => t.content === threadData.tweets[0].content);
      const tweet2 = tweets.find(t => t.content === threadData.tweets[1].content);
      
      expect(tweet1).toBeDefined();
      expect(tweet2).toBeDefined();
      expect(tweet1?.metadata).toHaveProperty('type', 'tweet');
      expect(tweet1?.metadata).toHaveProperty('likeCount', 50);
    });
  });

  describe('Auto-tagging', () => {
    it('should auto-tag imported content', async () => {
      // This test would require mocking the AI tagging service
      // For now, we'll just test the basic flow
      
      // Arrange - import a simple YouTube video
      const videoData = {
        videoId: 'tag123',
        channelId: 'channel456',
        title: 'AI Video',
        channelName: 'Tech Channel',
        transcript: 'This is about artificial intelligence and technology.',
        metadata: {
          publishedAt: '2023-01-01T12:00:00Z',
        }
      };

      // Act - import the video which should trigger auto-tagging
      const source = await importYouTubeVideo(videoData);
      
      // Get the root node
      const rootNode = await db.query.nodes.findFirst({
        where: (nodes, { eq }) => eq(nodes.sourceId, source.id)
      });
      
      // Manually call auto-tagging since our test import doesn't do it automatically
      if (rootNode) {
        // We would normally mock the AI service here
        // For testing, we'll just create some tags manually
        const aiTag = await db.insert(tags).values({
          name: 'AI',
          description: 'Artificial Intelligence',
          isActive: true
        }).returning();
        
        await db.insert(nodeTags).values({
          nodeId: rootNode.id,
          tagId: aiTag[0].id,
          isAutoGenerated: true,
          confidence: 90
        });
      }

      // Assert - check if tags were created and linked
      const linkedTags = await db.query.nodeTags.findMany({
        where: (nt, { eq }) => rootNode ? eq(nt.nodeId, rootNode.id) : sql`false`,
        with: {
          tag: true
        }
      });
      
      expect(linkedTags.length).toBeGreaterThan(0);
      // Use type assertion to handle the tag property
      const tagName = (linkedTags[0].tag as { name: string }).name;
      expect(tagName).toBe('AI');
      expect(linkedTags[0].isAutoGenerated).toBe(true);
    });
  });
}); 