import { BaseScout } from './base.js';
import { ScoutJob, ScoutResult, YouTubeJob, YouTubeVideo } from '../types/scout.js';
import { importYouTubeVideo } from '@minecollect/db/import-example';

export class YouTubeScout extends BaseScout {
  constructor() {
    super('youtube', {
      name: 'youtube',
      enabled: true,
      interval: 1800, // 30 minutes
      maxRetries: 3,
      timeout: 60000, // 1 minute
      rateLimit: {
        requests: 5,
        window: 60, // 1 request per 12 seconds
      },
    });
  }

  protected async onInitialize(): Promise<void> {
    // YouTube-specific initialization
    this.logger.info('YouTube scout initialized');
  }

  protected async onExecute(job: ScoutJob): Promise<ScoutResult> {
    const youtubeJob = job as YouTubeJob;
    
    try {
      // Extract video ID from URL
      const videoId = this.extractVideoId(youtubeJob.videoUrl);
      if (!videoId) {
        throw new Error('Invalid YouTube URL');
      }

      // Navigate to the video page
      await this.page!.goto(youtubeJob.videoUrl, { waitUntil: 'networkidle' });

      // Extract video metadata
      const videoData = await this.extractVideoData(videoId);

      // Get transcript if requested
      if (youtubeJob.includeTranscript) {
        videoData.transcript = await this.extractTranscript();
      }

      // Import to database
      await importYouTubeVideo({
        videoId: videoData.videoId,
        channelId: videoData.channelId,
        title: videoData.title,
        channelName: videoData.channelName,
        transcript: videoData.transcript || '',
        metadata: {
          publishedAt: videoData.publishedAt,
          duration: videoData.duration,
          viewCount: videoData.viewCount,
          likeCount: videoData.likeCount,
          description: videoData.description,
          tags: videoData.tags,
          thumbnails: videoData.thumbnails,
        },
      });

      return {
        success: true,
        data: videoData,
        metadata: {
          videoId,
          imported: true,
        },
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('Failed to process YouTube video', { 
        url: youtubeJob.videoUrl, 
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
    // YouTube-specific cleanup
    this.logger.info('YouTube scout cleanup completed');
  }

  private extractVideoId(url: string): string | null {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/v\/([^&\n?#]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  private async extractVideoData(videoId: string): Promise<YouTubeVideo> {
    const page = this.page!;

    // Wait for the page to load
    await page.waitForSelector('h1.ytd-watch-metadata', { timeout: 10000 });

    // Extract basic video information
    const title = await page.textContent('h1.ytd-watch-metadata') || '';
    
    // Extract channel information
    const channelName = await page.textContent('ytd-channel-name a') || '';
    const channelId = await page.getAttribute('ytd-channel-name a', 'href')
      ?.split('/').pop() || '';

    // Extract view count
    let viewCount: number | undefined;
    try {
      const viewText = await page.textContent('.view-count') || '';
      const viewMatch = viewText.match(/[\d,]+/);
      if (viewMatch) {
        viewCount = parseInt(viewMatch[0].replace(/,/g, ''));
      }
    } catch {
      // View count extraction is optional
    }

    // Extract like count (if available)
    let likeCount: number | undefined;
    try {
      const likeButton = await page.textContent('button[aria-label*="like"]');
      if (likeButton) {
        const likeMatch = likeButton.match(/[\d,]+/);
        if (likeMatch) {
          likeCount = parseInt(likeMatch[0].replace(/,/g, ''));
        }
      }
    } catch {
      // Like count extraction is optional
    }

    // Extract description
    let description: string | undefined;
    try {
      // Click "Show more" if it exists
      const showMoreButton = await page.$('tp-yt-paper-button#expand');
      if (showMoreButton) {
        await showMoreButton.click();
        await page.waitForTimeout(1000);
      }
      
      description = await page.textContent('#description-text') || undefined;
    } catch {
      // Description extraction is optional
    }

    // Extract duration from video player
    let duration: string | undefined;
    try {
      duration = await page.textContent('.ytp-time-duration') || undefined;
    } catch {
      // Duration extraction is optional
    }

    // Extract publish date
    let publishedAt = new Date().toISOString();
    try {
      const dateText = await page.textContent('#info-strings yt-formatted-string');
      if (dateText) {
        // Parse date from text like "Published on Dec 1, 2023"
        const dateMatch = dateText.match(/(\w+ \d+, \d+)/);
        if (dateMatch) {
          publishedAt = new Date(dateMatch[1]).toISOString();
        }
      }
    } catch {
      // Use current date as fallback
    }

    return {
      videoId,
      channelId,
      title: title.trim(),
      channelName: channelName.trim(),
      description,
      duration,
      publishedAt,
      viewCount,
      likeCount,
      tags: [], // Tags are not easily accessible via scraping
      thumbnails: {
        default: `https://img.youtube.com/vi/${videoId}/default.jpg`,
        medium: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
        high: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        maxres: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      },
    };
  }

  private async extractTranscript(): Promise<string | undefined> {
    const page = this.page!;

    try {
      // Look for transcript button
      const transcriptButton = await page.$('button[aria-label*="transcript" i]');
      if (!transcriptButton) {
        this.logger.warn('Transcript button not found');
        return undefined;
      }

      // Click transcript button
      await transcriptButton.click();
      await page.waitForTimeout(2000);

      // Wait for transcript panel to load
      await page.waitForSelector('ytd-transcript-segment-renderer', { timeout: 10000 });

      // Extract transcript segments
      const segments = await page.$$eval('ytd-transcript-segment-renderer', (elements) => {
        return elements.map(el => {
          const textElement = el.querySelector('.segment-text');
          return textElement ? textElement.textContent?.trim() || '' : '';
        }).filter(text => text.length > 0);
      });

      return segments.join(' ');
    } catch (error) {
      this.logger.warn('Failed to extract transcript', { error });
      return undefined;
    }
  }
}

// CLI runner for testing
if (import.meta.url === `file://${process.argv[1]}`) {
  const scout = new YouTubeScout();
  
  const testJob: YouTubeJob = {
    scoutName: 'youtube',
    videoUrl: process.argv[2] || 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    includeTranscript: true,
    includeComments: false,
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