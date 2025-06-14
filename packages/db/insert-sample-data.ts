// Script to insert sample data into the database
import { db } from './client';
import { sources, nodes } from './schema';

async function insertSampleData() {
  try {
    console.log('Inserting sample data...');
    
    // Insert sample sources
    const youtubeSource = await db.insert(sources).values({
      sourceUri: 'https://www.youtube.com/watch?v=sample-video-id',
      metadata: {
        title: 'Introduction to MineCollect',
        author: 'Tech Channel',
        duration: '10:25',
        views: 15000,
        likes: 1200,
        description: 'Learn how to use MineCollect to organize your digital knowledge.'
      },
    }).returning().then(res => res[0]);
    
    console.log('Inserted YouTube source:', youtubeSource.id);

    const chatgptSource = await db.insert(sources).values({
      sourceUri: 'app://chatgpt/conversation/sample-conversation-id',
      metadata: {
        title: 'Conversation about Knowledge Management',
        model: 'gpt-4',
        date: '2023-06-15',
        messages: 24
      },
    }).returning().then(res => res[0]);
    
    console.log('Inserted ChatGPT source:', chatgptSource.id);

    // Insert sample nodes for YouTube source
    const ytRootNode = await db.insert(nodes).values({
      sourceId: youtubeSource.id,
      path: 'Media.YouTube.TechChannel.Introduction',
      depth: 0,
      sortOrder: 0,
      title: 'Video Transcript',
      content: 'This is the full transcript of the video about MineCollect.',
      metadata: {
        type: 'transcript',
        language: 'en'
      }
    }).returning().then(res => res[0]);
    
    console.log('Inserted YouTube root node:', ytRootNode.id);

    // Insert child nodes for YouTube
    await db.insert(nodes).values([
      {
        sourceId: youtubeSource.id,
        parentId: ytRootNode.id,
        path: 'Media.YouTube.TechChannel.Introduction.Section1',
        depth: 1,
        sortOrder: 0,
        title: 'Introduction',
        content: 'Welcome to this introduction to MineCollect. Today we\'ll explore how this tool helps you organize your digital knowledge.',
        metadata: {
          timestamp: '00:00 - 01:30',
          type: 'section'
        }
      },
      {
        sourceId: youtubeSource.id,
        parentId: ytRootNode.id,
        path: 'Media.YouTube.TechChannel.Introduction.Section2',
        depth: 1,
        sortOrder: 1,
        title: 'Features Overview',
        content: 'MineCollect offers several key features: data ingestion from multiple sources, structured storage, and powerful search capabilities.',
        metadata: {
          timestamp: '01:31 - 04:45',
          type: 'section'
        }
      },
      {
        sourceId: youtubeSource.id,
        parentId: ytRootNode.id,
        path: 'Media.YouTube.TechChannel.Introduction.Section3',
        depth: 1,
        sortOrder: 2,
        title: 'Demo',
        content: 'Let me show you a quick demo of how MineCollect works in practice.',
        metadata: {
          timestamp: '04:46 - 08:30',
          type: 'section'
        }
      }
    ]);

    // Insert sample nodes for ChatGPT source
    const chatRootNode = await db.insert(nodes).values({
      sourceId: chatgptSource.id,
      path: 'Conversations.ChatGPT.KnowledgeManagement',
      depth: 0,
      sortOrder: 0,
      title: 'Conversation about Knowledge Management',
      content: 'A conversation with ChatGPT about knowledge management systems.',
      metadata: {
        type: 'conversation',
        messages: 24
      }
    }).returning().then(res => res[0]);
    
    console.log('Inserted ChatGPT root node:', chatRootNode.id);

    // Insert child nodes for ChatGPT (messages)
    await db.insert(nodes).values([
      {
        sourceId: chatgptSource.id,
        parentId: chatRootNode.id,
        path: 'Conversations.ChatGPT.KnowledgeManagement.Message1',
        depth: 1,
        sortOrder: 0,
        title: 'User',
        content: 'What are the best practices for personal knowledge management?',
        metadata: {
          role: 'user',
          timestamp: '2023-06-15T10:30:00Z'
        }
      },
      {
        sourceId: chatgptSource.id,
        parentId: chatRootNode.id,
        path: 'Conversations.ChatGPT.KnowledgeManagement.Message2',
        depth: 1,
        sortOrder: 1,
        title: 'Assistant',
        content: 'Personal knowledge management (PKM) is the process of collecting, organizing, and retrieving information for personal use. Here are some best practices:\n\n1. **Capture Everything**: Develop a system to quickly capture ideas, notes, and information as they come to you.\n\n2. **Organize Systematically**: Create a consistent organizational structure with tags, folders, or other classification systems.\n\n3. **Regular Review**: Schedule time to review and refine your knowledge base.\n\n4. **Connect Ideas**: Look for connections between different pieces of information to develop deeper understanding.\n\n5. **Use the Right Tools**: Choose tools that match your workflow and thinking style.',
        metadata: {
          role: 'assistant',
          model: 'gpt-4',
          timestamp: '2023-06-15T10:30:45Z'
        }
      },
      {
        sourceId: chatgptSource.id,
        parentId: chatRootNode.id,
        path: 'Conversations.ChatGPT.KnowledgeManagement.Message3',
        depth: 1,
        sortOrder: 2,
        title: 'User',
        content: 'What tools would you recommend for implementing these practices?',
        metadata: {
          role: 'user',
          timestamp: '2023-06-15T10:32:10Z'
        }
      },
      {
        sourceId: chatgptSource.id,
        parentId: chatRootNode.id,
        path: 'Conversations.ChatGPT.KnowledgeManagement.Message4',
        depth: 1,
        sortOrder: 3,
        title: 'Assistant',
        content: 'Here are some recommended tools for personal knowledge management:\n\n1. **Note-taking apps**: Notion, Obsidian, Evernote, Roam Research\n2. **Mind-mapping tools**: MindNode, XMind\n3. **Reference managers**: Zotero, Mendeley\n4. **Read-it-later apps**: Pocket, Instapaper\n5. **Spaced repetition systems**: Anki, RemNote\n6. **Automated capture tools**: Readwise, IFTTT\n\nThe best approach is often to combine several tools into a personalized system that works for your specific needs and workflow.',
        metadata: {
          role: 'assistant',
          model: 'gpt-4',
          timestamp: '2023-06-15T10:33:00Z'
        }
      }
    ]);

    console.log('Sample data inserted successfully!');
  } catch (error) {
    console.error('Error inserting sample data:', error);
  } finally {
    process.exit(0);
  }
}

insertSampleData(); 