import { z } from 'zod';

// Utility type to make properties with default values optional
type ZodInferWithDefaults<T extends z.ZodType> = 
  Partial<z.infer<T>> & 
  Omit<z.infer<T>, keyof z.infer<T>>;

export const ScoutConfigSchema = z.object({
  enabled: z.boolean().default(true),
  interval: z.number().default(3600), // seconds
  maxRetries: z.number().default(3),
  timeout: z.number().default(30000), // milliseconds
  rateLimit: z.object({
    requests: z.number().default(10),
    window: z.number().default(60), // seconds
  }).optional(),
});

export type ScoutConfig = ZodInferWithDefaults<typeof ScoutConfigSchema>;

export const ScoutJobSchema = z.object({
  scoutName: z.string(),
  url: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  priority: z.number().default(0),
  delay: z.number().default(0),
});

export type ScoutJob = ZodInferWithDefaults<typeof ScoutJobSchema>;

// Scout result
export const ScoutResultSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  metadata: z.record(z.any()).optional(),
  error: z.string().optional(),
  timestamp: z.date().default(() => new Date()),
});

export type ScoutResult = ZodInferWithDefaults<typeof ScoutResultSchema>;

// Base scout interface
export interface Scout {
  name: string;
  config: ScoutConfig;
  
  // Initialize the scout (setup browser, auth, etc.)
  initialize(): Promise<void>;
  
  // Execute a single scouting job
  execute(job: ScoutJob): Promise<ScoutResult>;
  
  // Cleanup resources
  cleanup(): Promise<void>;
  
  // Health check
  healthCheck(): Promise<boolean>;
}

// YouTube specific types
export const YouTubeVideoSchema = z.object({
  videoId: z.string(),
  channelId: z.string(),
  title: z.string(),
  channelName: z.string(),
  description: z.string().optional(),
  transcript: z.string().optional(),
  duration: z.string().optional(),
  publishedAt: z.string(),
  viewCount: z.number().optional(),
  likeCount: z.number().optional(),
  commentCount: z.number().optional(),
  tags: z.array(z.string()).optional(),
  thumbnails: z.record(z.string()).optional(),
});

export type YouTubeVideo = z.infer<typeof YouTubeVideoSchema>;

export const YouTubeJobSchema = ScoutJobSchema.extend({
  videoUrl: z.string().url(),
  includeTranscript: z.boolean().default(true),
  includeComments: z.boolean().default(false),
});

export type YouTubeJob = ZodInferWithDefaults<typeof YouTubeJobSchema>;

// ChatGPT specific types
export const ChatGPTConversationSchema = z.object({
  id: z.string(),
  title: z.string(),
  createTime: z.number(),
  updateTime: z.number(),
  messages: z.array(z.object({
    id: z.string(),
    author: z.object({
      role: z.enum(['user', 'assistant', 'system']),
      name: z.string().optional(),
    }),
    content: z.object({
      contentType: z.string(),
      parts: z.array(z.string()),
    }),
    createTime: z.number().optional(),
    updateTime: z.number().optional(),
    metadata: z.record(z.any()).optional(),
  })),
  metadata: z.record(z.any()).optional(),
});

export type ChatGPTConversation = z.infer<typeof ChatGPTConversationSchema>;

export const ChatGPTJobSchema = ScoutJobSchema.extend({
  conversationId: z.string().optional(),
  dateRange: z.object({
    from: z.date(),
    to: z.date(),
  }).optional(),
  includeShared: z.boolean().default(false),
});

export type ChatGPTJob = ZodInferWithDefaults<typeof ChatGPTJobSchema>; 