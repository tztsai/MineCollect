import { db, sources, nodes, tags, nodeTags } from './client';
import { createHash } from 'crypto';

// Utility function to generate content hash
function generateContentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

// Utility function to create ltree path
function createPath(...segments: string[]): string {
  return segments
    .map(s => s.replace(/[^a-zA-Z0-9_]/g, '_'))
    .join('.');
}

// Define the structure for transcript segments
interface TranscriptSegment {
  text: string;
  startTime: number;
  endTime: number;
}

// YouTube Video Import
export async function importYouTubeVideo(videoData: {
  videoId: string;
  channelId: string;
  title: string;
  channelName: string;
  transcript: string;
  metadata: any;
}) {
  // Use the web URL as the sourceUri for browser-accessible content
  const sourceUri = `https://www.youtube.com/watch?v=${videoData.videoId}`;
  
  // Create source
  const [source] = await db.insert(sources).values({
    sourceUri,
    metadata: {
      ...videoData.metadata,
      channelId: videoData.channelId,
      channelName: videoData.channelName,
    },
    timestamp: new Date(videoData.metadata.publishedAt),
  }).returning();

  // Create root node
  const rootPath = createPath('Video', 'YouTube', videoData.channelName, videoData.title);
  const [rootNode] = await db.insert(nodes).values({
    sourceId: source.id,
    path: rootPath,
    title: videoData.title,
    content: `YouTube video: ${videoData.title}`,
    depth: 0,
    sortOrder: 0,
    metadata: {
      type: 'video_root',
    },
  }).returning();

  // Split transcript into segments and create child nodes
  const transcriptSegments = splitTranscript(videoData.transcript);
  for (let i = 0; i < transcriptSegments.length; i++) {
    const segment = transcriptSegments[i];
    await db.insert(nodes).values({
      sourceId: source.id,
      parentId: rootNode.id,
      path: createPath(rootPath, 'Transcript', `Segment_${String(i + 1).padStart(3, '0')}`),
      title: `Transcript Segment ${i + 1}`,
      content: segment.text,
      depth: 1,
      sortOrder: i,
      metadata: {
        type: 'transcript_segment',
        startTime: segment.startTime,
        endTime: segment.endTime,
      },
    });
  }

  return source;
}

// Readwise Highlight Import
export async function importReadwiseHighlight(highlightData: {
  highlightId: string;
  text: string;
  note?: string;
  bookTitle: string;
  author: string;
  location: string;
  highlightedAt: string;
}) {
  // Readwise highlights aren't directly browser-accessible, so use the app scheme
  const sourceUri = `kindle://book/${highlightData.bookTitle.replace(/\s+/g, '-')}/highlight-${highlightData.highlightId}`;
  
  const [source] = await db.insert(sources).values({
    sourceUri,
    metadata: {
      bookTitle: highlightData.bookTitle,
      author: highlightData.author,
      location: highlightData.location,
      note: highlightData.note,
      highlightId: highlightData.highlightId,
    },
    timestamp: new Date(highlightData.highlightedAt),
  }).returning();

  // Create book root node if it doesn't exist
  const bookPath = createPath('Reading', 'Books', highlightData.author, highlightData.bookTitle);
  
  // Create highlight node
  await db.insert(nodes).values({
    sourceId: source.id,
    path: createPath(bookPath, `Highlight_${highlightData.highlightId}`),
    title: `Highlight from ${highlightData.location}`,
    content: highlightData.text,
    depth: 1,
    metadata: {
      type: 'highlight',
      location: highlightData.location,
      note: highlightData.note,
    },
  });

  return source;
}

// Reddit Post Import
export async function importRedditPost(postData: {
  postId: string;
  subreddit: string;
  title: string;
  content: string;
  author: string;
  comments: Array<{
    id: string;
    author: string;
    content: string;
    parentId?: string;
    depth: number;
  }>;
  metadata: any;
}) {
  // Use the web URL as the sourceUri for browser-accessible content
  const sourceUri = `https://reddit.com/r/${postData.subreddit}/comments/${postData.postId}/`;
  
  const [source] = await db.insert(sources).values({
    sourceUri,
    metadata: {
      ...postData.metadata,
      author: postData.author,
      subreddit: postData.subreddit,
    },
    timestamp: new Date(postData.metadata.postedAt),
  }).returning();

  // Create root node
  const rootPath = createPath('Social', 'Reddit', postData.subreddit, `Post_${postData.postId}`);
  const [rootNode] = await db.insert(nodes).values({
    sourceId: source.id,
    path: rootPath,
    title: postData.title,
    content: postData.content,
    depth: 0,
    metadata: {
      type: 'reddit_post',
      author: postData.author,
    },
  }).returning();

  // Create comment nodes
  for (const comment of postData.comments) {
    await db.insert(nodes).values({
      sourceId: source.id,
      parentId: rootNode.id,
      path: createPath(rootPath, 'Comments', `Comment_${comment.id}`),
      title: `Comment by ${comment.author}`,
      content: comment.content,
      depth: comment.depth + 1,
      metadata: {
        type: 'reddit_comment',
        author: comment.author,
        parentCommentId: comment.parentId,
      },
    });
  }

  return source;
}

// Twitter Thread Import
export async function importTwitterThread(threadData: {
  tweets: Array<{
    id: string;
    author: string;
    content: string;
    createdAt: string;
    metadata: any;
  }>;
}) {
  const mainTweet = threadData.tweets[0];
  // Use the web URL as the sourceUri for browser-accessible content
  const sourceUri = `https://twitter.com/${mainTweet.author}/status/${mainTweet.id}`;
  
  const [source] = await db.insert(sources).values({
    sourceUri,
    metadata: {
      author: mainTweet.author,
      threadLength: threadData.tweets.length,
      createdAt: mainTweet.createdAt,
    },
    timestamp: new Date(mainTweet.createdAt),
  }).returning();

  // Create root node for thread
  const rootPath = createPath('Social', 'Twitter', mainTweet.author, `Thread_${mainTweet.id}`);
  const [rootNode] = await db.insert(nodes).values({
    sourceId: source.id,
    path: rootPath,
    title: `Twitter Thread by @${mainTweet.author}`,
    content: `Thread with ${threadData.tweets.length} tweets`,
    depth: 0,
    metadata: {
      type: 'twitter_thread',
    },
  }).returning();

  // Create individual tweet nodes
  for (let i = 0; i < threadData.tweets.length; i++) {
    const tweet = threadData.tweets[i];
    await db.insert(nodes).values({
      sourceId: source.id,
      parentId: rootNode.id,
      path: createPath(rootPath, `Tweet_${String(i + 1).padStart(3, '0')}`),
      title: `Tweet ${i + 1}/${threadData.tweets.length}`,
      content: tweet.content,
      depth: 1,
      sortOrder: i,
      metadata: {
        type: 'tweet',
        ...tweet.metadata,
      },
    });
  }

  return source;
}

// Auto-tagging function
export async function autoTagContent(sourceId: string, content: string) {
  // This would use AI/ML to automatically generate tags
  const suggestedTags = await generateTagsFromContent(content);
  
  for (const tagName of suggestedTags) {
    // Find or create tag
    let tag = await db.query.tags.findFirst({
      where: (tags, { eq }) => eq(tags.name, tagName)
    });
    
    if (!tag) {
      [tag] = await db.insert(tags).values({
        name: tagName,
        description: `Auto-generated tag for ${tagName}`,
        isActive: true,
      }).returning();
    }
    
    if (tag) {
      // Link tag to node
      await db.insert(nodeTags).values({
        nodeId: sourceId, // This should be a nodeId, not sourceId
        tagId: tag.id,
        isAutoGenerated: true,
        confidence: 85, // AI confidence score
      });
    }
  }
}

// Utility functions
function splitTranscript(transcript: string): TranscriptSegment[] {
  // Split transcript into meaningful segments
  // This is a simplified version - you'd want more sophisticated chunking
  const sentences = transcript.split(/[.!?]+/);
  const segments: TranscriptSegment[] = [];
  
  for (let i = 0; i < sentences.length; i += 3) {
    segments.push({
      text: sentences.slice(i, i + 3).join('. '),
      startTime: i * 10, // Simplified timing
      endTime: (i + 3) * 10,
    });
  }
  
  return segments;
}

async function generateTagsFromContent(content: string): Promise<string[]> {
  // This would integrate with your AI service to generate relevant tags
  // For now, return some example tags
  return ['AI', 'Technology', 'Learning'];
}

// Batch import function
export async function batchImport(imports: Array<{
  type: 'youtube' | 'readwise' | 'reddit' | 'twitter';
  data: any;
}>) {
  const results: Array<{ success: boolean; sourceId?: string; error?: string }> = [];
  
  for (const item of imports) {
    try {
      let result;
      switch (item.type) {
        case 'youtube':
          result = await importYouTubeVideo(item.data);
          break;
        case 'readwise':
          result = await importReadwiseHighlight(item.data);
          break;
        case 'reddit':
          result = await importRedditPost(item.data);
          break;
        case 'twitter':
          result = await importTwitterThread(item.data);
          break;
      }
      
      if (result) {
        // Auto-tag the content - this should be using a nodeId, not sourceId
        // For simplicity, we'll assume the first node of the source
        const firstNode = await db.query.nodes.findFirst({
          where: (nodes, { eq }) => eq(nodes.sourceId, result.id)
        });
        
        if (firstNode) {
          await autoTagContent(firstNode.id, item.data.content || item.data.text || '');
        }
        
        results.push({ success: true, sourceId: result.id });
      }
    } catch (error: any) {
      results.push({ success: false, error: error.message });
    }
  }
  
  return results;
} 