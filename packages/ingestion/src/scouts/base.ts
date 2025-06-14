import { Browser, BrowserContext, Page, chromium } from 'playwright';
import PQueue from 'p-queue';
import { Scout, ScoutConfig, ScoutJob, ScoutResult } from '../types/scout.js';
import { createScoutLogger } from '../utils/logger.js';

export abstract class BaseScout implements Scout {
  public name: string;
  public config: ScoutConfig;
  
  protected browser?: Browser;
  protected context?: BrowserContext;
  protected page?: Page;
  protected queue: PQueue;
  protected logger: any;

  constructor(name: string, config: ScoutConfig) {
    this.name = name;
    this.config = config;
    this.logger = createScoutLogger(name);
    
    // Initialize rate-limited queue
    this.queue = new PQueue({
      concurrency: 1,
      interval: (config.rateLimit?.window || 60) * 1000,
      intervalCap: config.rateLimit?.requests || 10,
    });
  }

  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing scout', { name: this.name });
      
      // Launch browser
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
        ],
      });

      // Create context with realistic user agent
      this.context = await this.browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        locale: 'en-US',
        timezoneId: 'America/New_York',
      });

      // Create page
      this.page = await this.context.newPage();
      
      // Set timeout
      this.page.setDefaultTimeout(this.config.timeout);
      
      await this.onInitialize();
      
      this.logger.info('Scout initialized successfully', { name: this.name });
    } catch (error) {
      this.logger.error('Failed to initialize scout', { 
        name: this.name, 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  async execute(job: ScoutJob): Promise<ScoutResult> {
    return this.queue.add(async () => {
      const startTime = Date.now();
      
      try {
        this.logger.info('Executing scout job', { 
          name: this.name, 
          job: { ...job, metadata: undefined } // Don't log full metadata
        });

        if (!this.page) {
          throw new Error('Scout not initialized');
        }

        const result = await this.onExecute(job);
        
        const duration = Date.now() - startTime;
        this.logger.info('Scout job completed successfully', { 
          name: this.name, 
          duration,
          success: result.success 
        });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        this.logger.error('Scout job failed', { 
          name: this.name, 
          duration,
          error: errorMessage 
        });

        return {
          success: false,
          error: errorMessage,
          timestamp: new Date(),
        };
      }
    });
  }

  async cleanup(): Promise<void> {
    try {
      this.logger.info('Cleaning up scout', { name: this.name });
      
      await this.onCleanup();
      
      if (this.page) {
        await this.page.close();
      }
      
      if (this.context) {
        await this.context.close();
      }
      
      if (this.browser) {
        await this.browser.close();
      }
      
      this.logger.info('Scout cleanup completed', { name: this.name });
    } catch (error) {
      this.logger.error('Error during scout cleanup', { 
        name: this.name, 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.browser || !this.context || !this.page) {
        return false;
      }
      
      // Simple health check - navigate to a basic page
      await this.page.goto('data:text/html,<html><body>Health Check</body></html>');
      return true;
    } catch {
      return false;
    }
  }

  // Abstract methods to be implemented by specific scouts
  protected abstract onInitialize(): Promise<void>;
  protected abstract onExecute(job: ScoutJob): Promise<ScoutResult>;
  protected abstract onCleanup(): Promise<void>;

  // Utility methods for scouts
  protected async waitForSelector(selector: string, timeout?: number): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');
    await this.page.waitForSelector(selector, { timeout: timeout || this.config.timeout });
  }

  protected async safeClick(selector: string): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');
    
    try {
      await this.page.waitForSelector(selector, { timeout: 5000 });
      await this.page.click(selector);
    } catch (error) {
      this.logger.warn('Failed to click selector', { selector, error });
      throw error;
    }
  }

  protected async safeType(selector: string, text: string): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');
    
    try {
      await this.page.waitForSelector(selector, { timeout: 5000 });
      await this.page.fill(selector, text);
    } catch (error) {
      this.logger.warn('Failed to type in selector', { selector, error });
      throw error;
    }
  }

  protected async scrollToBottom(): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');
    
    await this.page.evaluate(() => {
      return new Promise<void>((resolve) => {
        let totalHeight = 0;
        const distance = 100;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;

          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });
  }
} 