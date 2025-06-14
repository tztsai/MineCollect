import { BaseScout } from './base.js';
import { ScoutJob, ScoutResult, ChatGPTJob, ChatGPTConversation } from '../types/scout.js';
import { format, subDays } from 'date-fns';
import { db } from '@minecollect/db/client';
import { sources, nodes } from '@minecollect/db/schema';
import { createPath } from '../utils/path.js';

export class ChatGPTScout extends BaseScout {
  private isLoggedIn = false;

  constructor() {
    super('chatgpt', {
      enabled: true,
      interval: 3600, // 1 hour
      maxRetries: 3,
      timeout: 120000, // 2 minutes
      rateLimit: {
        requests: 3,
        window: 60, // 1 request per 20 seconds
      },
    });
  }

  protected async onInitialize(): Promise<void> {
    // ChatGPT-specific initialization
    await this.login();
    this.logger.info('ChatGPT scout initialized');
  }

  protected async onExecute(job: ScoutJob): Promise<ScoutResult> {
    const chatgptJob = job as ChatGPTJob;
    
    try {
      // Ensure we're logged in
      if (!this.isLoggedIn) {
        await this.login();
      }

      let conversations: ChatGPTConversation[] = [];

      if (chatgptJob.conversationId) {
        // Get specific conversation
        const conversation = await this.getConversation(chatgptJob.conversationId);
        if (conversation) {
          conversations = [conversation];
        }
      } else {
        // Get conversations within date range
        const dateRange = chatgptJob.dateRange || {
          from: subDays(new Date(), 7), // Last 7 days by default
          to: new Date(),
        };
        
        conversations = await this.getConversations(dateRange.from, dateRange.to);
      }

      // Import conversations to database
      const importResults = [];
      for (const conversation of conversations) {
        try {
          // Import conversation to database
          const result = await this.importConversation(conversation);
          
          this.logger.info('Imported conversation', { 
            id: conversation.id, 
            title: conversation.title,
            messageCount: conversation.messages.length,
            sourceId: result.sourceId
          });
          
          importResults.push({ 
            success: true, 
            conversationId: conversation.id,
            sourceId: result.sourceId
          });
        } catch (error) {
          this.logger.error('Failed to import conversation', { 
            id: conversation.id, 
            error: error instanceof Error ? error.message : String(error) 
          });
          importResults.push({ 
            success: false, 
            conversationId: conversation.id, 
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      return {
        success: true,
        data: {
          conversations,
          importResults,
        },
        metadata: {
          conversationCount: conversations.length,
          imported: importResults.filter(r => r.success).length,
        },
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('Failed to process ChatGPT conversations', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
      };
    }
  }

  protected async onCleanup(): Promise<void> {
    // ChatGPT-specific cleanup
    this.logger.info('ChatGPT scout cleanup completed');
  }

  private async login(): Promise<void> {
    const page = this.page!;
    
    try {
      // Navigate to ChatGPT
      await page.goto('https://chat.openai.com/', { waitUntil: 'networkidle' });

      // Check if already logged in
      const isAlreadyLoggedIn = await page.$('nav[aria-label="Chat history"]') !== null;
      if (isAlreadyLoggedIn) {
        this.isLoggedIn = true;
        this.logger.info('Already logged in to ChatGPT');
        return;
      }

      // Look for login button
      const loginButton = await page.$('button:has-text("Log in")');
      if (loginButton) {
        await loginButton.click();
        await page.waitForTimeout(2000);
      }

      // Wait for manual login or session restoration
      this.logger.info('Waiting for ChatGPT login...');
      this.logger.info('Please log in manually in the browser window');
      
      // Wait for the chat interface to appear (indicating successful login)
      await page.waitForSelector('nav[aria-label="Chat history"]', { timeout: 300000 }); // 5 minutes
      
      this.isLoggedIn = true;
      this.logger.info('Successfully logged in to ChatGPT');
    } catch (error) {
      this.logger.error('Failed to login to ChatGPT', { error });
      throw new Error('ChatGPT login failed');
    }
  }

  private async getConversations(fromDate: Date, toDate: Date): Promise<ChatGPTConversation[]> {
    const page = this.page!;
    const conversations: ChatGPTConversation[] = [];

    try {
      // Navigate to chat history
      await page.goto('https://chat.openai.com/', { waitUntil: 'networkidle' });
      
      // Wait for chat history to load
      await page.waitForSelector('nav[aria-label="Chat history"]', { timeout: 10000 });

      // Scroll through chat history to load more conversations
      const chatHistory = await page.$('nav[aria-label="Chat history"]');
      if (chatHistory) {
        // Scroll to load more conversations
        for (let i = 0; i < 5; i++) {
          await page.evaluate(() => {
            const nav = document.querySelector('nav[aria-label="Chat history"]');
            if (nav) {
              nav.scrollTop = nav.scrollHeight;
            }
          });
          await page.waitForTimeout(1000);
        }
      }

      // Get all conversation links
      const conversationLinks = await page.$$('nav[aria-label="Chat history"] a[href*="/c/"]');
      
      this.logger.info(`Found ${conversationLinks.length} conversations`);

      // Process each conversation
      for (const link of conversationLinks.slice(0, 20)) { // Limit to 20 most recent
        try {
          const href = await link.getAttribute('href');
          const title = await link.textContent();
          
          if (href && title) {
            const conversationId = href.split('/c/')[1];
            const conversation = await this.getConversation(conversationId);
            
            if (conversation) {
              // Check if conversation is within date range
              const conversationDate = new Date(conversation.createTime * 1000);
              if (conversationDate >= fromDate && conversationDate <= toDate) {
                conversations.push(conversation);
              }
            }
          }
        } catch (error) {
          this.logger.warn('Failed to process conversation link', { error });
        }
      }

      return conversations;
    } catch (error) {
      this.logger.error('Failed to get conversations', { error });
      return [];
    }
  }

  private async getConversation(conversationId: string): Promise<ChatGPTConversation | null> {
    const page = this.page!;

    try {
      // Navigate to specific conversation
      await page.goto(`https://chat.openai.com/c/${conversationId}`, { waitUntil: 'networkidle' });
      
      // Wait for conversation to load
      await page.waitForSelector('[data-testid^="conversation-turn-"]', { timeout: 10000 });

      // Extract conversation title
      const title = await page.textContent('h1') || `Conversation ${conversationId}`;

      // Extract messages
      const messages = await page.$$eval('[data-testid^="conversation-turn-"]', (elements) => {
        return elements.map((el, index) => {
          const isUser = el.getAttribute('data-testid')?.includes('user') || 
                        el.querySelector('[data-message-author-role="user"]') !== null;
          
          const contentEl = el.querySelector('[data-message-content="true"]') || 
                           el.querySelector('.markdown') ||
                           el.querySelector('div[class*="prose"]');
          
          const content = contentEl ? contentEl.textContent?.trim() || '' : '';

          return {
            id: `msg-${index}`,
            author: {
              role: isUser ? 'user' as const : 'assistant' as const,
            },
            content: {
              contentType: 'text',
              parts: [content],
            },
            createTime: Date.now() / 1000, // Approximate timestamp
            updateTime: Date.now() / 1000,
          };
        }).filter(msg => msg.content.parts[0].length > 0);
      });

      const now = Date.now() / 1000;
      
      return {
        id: conversationId,
        title: title.trim(),
        createTime: now,
        updateTime: now,
        messages,
        metadata: {
          url: `https://chat.openai.com/c/${conversationId}`,
          extractedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error('Failed to get conversation', { conversationId, error });
      return null;
    }
  }

  private async importConversation(conversation: ChatGPTConversation) {
    // Check if conversation already exists in database
    const existingSource = await db.query.sources.findFirst({
      where: (sources, { eq }) => eq(sources.sourceUri, `https://chat.openai.com/c/${conversation.id}`),
    });

    if (existingSource) {
      this.logger.info('Conversation already exists in database', { 
        id: conversation.id,
        sourceId: existingSource.id
      });
      return { sourceId: existingSource.id };
    }

    // Create source
    const [source] = await db.insert(sources).values({
      sourceUri: `https://chat.openai.com/c/${conversation.id}`,
      metadata: {
        title: conversation.title,
        messageCount: conversation.messages.length,
        model: conversation.metadata?.model || 'gpt-4',
        extractedAt: conversation.metadata?.extractedAt,
      },
      timestamp: new Date(conversation.createTime * 1000),
    }).returning();

    // Create root node for conversation
    const rootPath = createPath('Conversations', 'ChatGPT', `Chat_${conversation.id}`);
    const [rootNode] = await db.insert(nodes).values({
      sourceId: source.id,
      path: rootPath,
      title: conversation.title,
      content: `ChatGPT conversation: ${conversation.title}`,
      depth: 0,
      sortOrder: 0,
      metadata: {
        type: 'chatgpt_conversation',
        url: `https://chat.openai.com/c/${conversation.id}`,
      },
    }).returning();

    // Create individual message nodes
    for (let i = 0; i < conversation.messages.length; i++) {
      const message = conversation.messages[i];
      await db.insert(nodes).values({
        sourceId: source.id,
        parentId: rootNode.id,
        path: createPath(rootPath, `Message_${String(i + 1).padStart(3, '0')}`),
        title: `${message.author.role === 'user' ? 'User' : 'Assistant'} message ${i + 1}`,
        content: message.content.parts.join('\n'),
        depth: 1,
        sortOrder: i,
        metadata: {
          type: 'chatgpt_message',
          role: message.author.role,
          messageId: message.id,
          messageIndex: i,
        },
      });
    }

    return { sourceId: source.id };
  }

  private convertToThreadFormat(conversation: ChatGPTConversation) {
    // Convert ChatGPT conversation to a format similar to Twitter thread
    return {
      tweets: conversation.messages.map((message, index) => ({
        id: message.id,
        author: message.author.role === 'user' ? 'user' : 'assistant',
        content: message.content.parts.join('\n'),
        createdAt: new Date(message.createTime! * 1000).toISOString(),
        metadata: {
          role: message.author.role,
          conversationId: conversation.id,
          messageIndex: index,
        },
      })),
    };
  }
}

// CLI runner for testing
if (typeof process !== 'undefined' && import.meta.url === `file://${process.argv[1]}`) {
  const scout = new ChatGPTScout();
  
  const testJob: ChatGPTJob = {
    scoutName: 'chatgpt',
    dateRange: {
      from: subDays(new Date(), 7),
      to: new Date(),
    },
    includeShared: false,
  };

  async function main() {
    try {
      await scout.initialize();
      const result = await scout.execute(testJob);
      console.log('Result:', JSON.stringify(result, null, 2));
    } catch (error) {
      console.error('Error:', error);
    } finally {
      await scout.cleanup();
    }
  }

  main().catch(console.error);
} 