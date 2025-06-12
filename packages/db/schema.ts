import {
    pgTable,
    uuid,
    text,
    jsonb,
    timestamp,
    index,
    primaryKey,
    integer,
    customType,
  } from "drizzle-orm/pg-core";
  import { relations } from "drizzle-orm";
  
  // --- Custom Types for PostgreSQL-specific columns ---
  
  /**
   * Custom Drizzle type for `pgvector`.
   * Assumes a vector of 1536 dimensions, standard for OpenAI embeddings.
   * The vector is stored as a string in the driver and parsed back into an array.
   */
  const vector = customType<{ data: number[]; driverData: string }>({
    dataType() {
      return "vector(1536)";
    },
    toDriver(value: number[]): string {
      return `[${value.join(",")}]`;
    },
    fromDriver(value: string): number[] {
      // Assumes the format is '[1,2,3]'
      return value.slice(1, -1).split(",").map(Number);
    },
  });
  
  /**
   * Custom Drizzle type for `ltree` for hierarchical pathing.
   * See: https://www.postgresql.org/docs/current/ltree.html
   */
  const ltree = customType<{ data: string }>({
    dataType() {
      return "ltree";
    },
  });
  
  // --- Core Tables ---
  
  /**
   * The central table for all ingested content. Each row represents a single,
   * discrete piece of knowledge, regardless of its source.
   */
  export const items = pgTable(
    "items",
    {
      id: uuid("id").primaryKey().defaultRandom(),
  
      // --- URI & Identification ---
      /**
       * The unique, internal URI for the item, following the MineCollect URI schema.
       * e.g., 'chat://chatgpt/session/abc/turn-12', 'https://twitter.com/user/status/123'
       * This is the primary key for identifying content across the system.
       */
      sourceUri: text("source_uri").notNull().unique(),
  
      /**
       * The canonical, publicly accessible URL for the item, if one exists.
       * e.g., https://www.youtube.com/watch?v=...
       */
      canonicalUri: text("canonical_uri"),
  
      /**
       * A SHA256 hash of the normalized content to aid in deduplication.
       * Ingestion workers should compute this before insertion.
       */
      contentHash: text("content_hash").notNull().unique(),
  
      // --- Organization & Metadata ---
      /**
       * Hierarchical path for organizing the item, using ltree.
       * e.g., 'Snapshots.Tweets.Tech.12345', 'Readings.Articles.AI.NavalOnWealth'
       */
      path: ltree("path").notNull(),
  
      /**
       * The common name of the data source (e.g., 'twitter', 'readwise', 'chatgpt').
       * Used for filtering and identifying the ingestion worker.
       */
      sourceName: text("source_name").notNull(),
      title: text("title"),
      /**
       * A cleaned, simplified version of the content suitable for direct display.
       * For a tweet, this would be the text; for a highlight, the highlighted text.
       */
      displayContent: text("display_content"),
  
      /**
       * The original, unprocessed content from the source. This could be raw JSON
       * from an API, HTML from a webpage, etc. Stored as JSONB for flexibility.
       */
      rawContent: jsonb("raw_content"),
  
      /**
       * Any additional, source-specific metadata that doesn't fit in other columns.
       * e.g., For a tweet: { likes: 100, retweets: 50, authorId: '...' }
       */
      metadata: jsonb("metadata"),
  
      // --- Timestamps ---
      /**
       * The original timestamp of the content creation (e.g., when a tweet was posted).
       */
      itemTimestamp: timestamp("item_timestamp", { withTimezone: true }),
      createdAt: timestamp("created_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    },
    (table) => ({
      // Indexes for common query patterns
      sourceNameIdx: index("source_name_idx").on(table.sourceName),
      pathIdx: index("path_idx").on(table.path).using("gist"), // GIST index is recommended for ltree
      itemTimestampIdx: index("item_timestamp_idx").on(table.itemTimestamp),
    }),
  );
  
  /**
   * Holds the individual chunks of content derived from an `Item`.
   * This is the foundation for Retrieval-Augmented Generation (RAG).
   */
  export const chunks = pgTable(
    "chunks",
    {
      id: uuid("id").primaryKey().defaultRandom(),
      itemId: uuid("item_id")
        .notNull()
        .references(() => items.id, { onDelete: "cascade" }),
  
      /**
       * The text content of this specific chunk.
       */
      content: text("content").notNull(),
      /**
       * The vector embedding for this chunk's content. Used for semantic search.
       */
      embedding: vector("embedding"),
      /**
       * Metadata specific to this chunk, e.g., { page: 3, paragraph: 2 }.
       */
      metadata: jsonb("metadata"),
      createdAt: timestamp("created_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    },
    (table) => ({
      itemIdIdx: index("chunk_item_id_idx").on(table.itemId),
      // IVFFlat index is a good starting point for vector search performance.
      embeddingIdx: index("chunk_embedding_idx")
        .on(table.embedding)
        .using("ivfflat", { opclass: "vector_l2_ops" })
        .with({ lists: 100 }),
    }),
  );
  
  /**
   * A simple table to store unique tags.
   */
  export const tags = pgTable("tags", {
    id: integer("id").primaryKey(),
    name: text("name").notNull().unique(),
  });
  
  /**
   * A join table to create a many-to-many relationship between items and tags.
   */
  export const itemTags = pgTable(
    "item_tags",
    {
      itemId: uuid("item_id")
        .notNull()
        .references(() => items.id, { onDelete: "cascade" }),
      tagId: integer("tag_id")
        .notNull()
        .references(() => tags.id, { onDelete: "cascade" }),
    },
    (table) => ({
      pk: primaryKey({ columns: [table.itemId, table.tagId] }),
    }),
  );
  
  // --- Relations ---
  
  export const itemsRelations = relations(items, ({ many }) => ({
    chunks: many(chunks),
    itemTags: many(itemTags),
  }));
  
  export const chunksRelations = relations(chunks, ({ one }) => ({
    item: one(items, {
      fields: [chunks.itemId],
      references: [items.id],
    }),
  }));
  
  export const tagsRelations = relations(tags, ({ many }) => ({
    itemTags: many(itemTags),
  }));
  
  export const itemTagsRelations = relations(itemTags, ({ one }) => ({
    item: one(items, {
      fields: [itemTags.itemId],
      references: [items.id],
    }),
    tag: one(tags, {
      fields: [itemTags.tagId],
      references: [tags.id],
    }),
  }));
  