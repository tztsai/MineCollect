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
  export const assets = pgTable(
    "assets",
    {
      id: uuid("id").primaryKey().defaultRandom(),
  
      // --- URI & Identification ---
      /**
       * The unique, internal URI for the asset, following the MineCollect URI schema.
       * e.g., 'chat://chatgpt/session/abc/turn-12', 'app://twitter/user/status/123'
       * This is the primary key for identifying content across the system.
       */
      sourceUri: text("source_uri").notNull().unique(),
  
      /**
       * The publicly accessible URL for the asset, if one exists.
       * e.g., https://www.youtube.com/watch?v=...
       */
      webUrl: text("web_url"),
  
      /**
       * A SHA256 hash of the normalized content to aid in deduplication.
       * Ingestion workers should compute this before insertion.
       */
      contentHash: text("content_hash").notNull().unique(),
  
      // --- Organization & Metadata ---
      /**
       * Hierarchical path for organizing the asset, using ltree.
       * e.g., 'Snapshots.Tweets.Tech.12345', 'Readings.Articles.AI.NavalOnWealth'
       */
      path: ltree("path").notNull(),
  
      /**
       * Any additional, source-specific metadata that doesn't fit in other columns.
       * e.g., For a tweet: { likes: 100, retweets: 50, authorId: '...' }
       */
      metadata: jsonb("metadata"),
  
      // --- Timestamps ---
      /**
       * The original timestamp of the content creation (e.g., when a tweet was posted).
       */
      timestamp: timestamp("timestamp", { withTimezone: true }),

      /**
       * Reference to the root node of this asset's content tree.
       * Each asset must have at least one node.
       */
      rootNodeId: uuid("root_node_id"),
    },
    (table) => ({
      // Indexes for common query patterns
      sourceUriIdx: index("source_uri_idx").on(table.sourceUri),
      pathIdx: index("path_idx").on(table.path), // GiST index is recommended for ltree
      timestampIdx: index("timestamp_idx").on(table.timestamp),
    }),
  );
  
  /**
   * Holds the individual nodes of content derived from an `asset`.
   * Nodes are arranged in a tree structure with parent-child relationships.
   * This is the foundation for Retrieval-Augmented Generation (RAG).
   */
  export const nodes = pgTable(
    "nodes",
    {
      id: uuid("id").primaryKey().defaultRandom(),
      
      assetId: uuid("asset_id")
        .notNull()
        .references(() => assets.id, { onDelete: "cascade" }),

      /**
       * Reference to the parent node in the tree structure.
       * Null for root nodes.
       */
      parentId: uuid("parent_id").references(() => nodes.id),
  
      title: text("title"),
      content: text("content"),
      
      /**
       * The vector embedding for this node's content. Used for semantic search.
       */
      embedding: vector("embedding"),
      
      /**
       * Metadata specific to this node, e.g., { page: 3, paragraph: 2 }.
       */
      metadata: jsonb("metadata"),
      
      createdAt: timestamp("created_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
        
      updatedAt: timestamp("updated_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    },
    (table) => ({
      assetIdx: index("node_asset_idx").on(table.assetId),
      parentIdx: index("node_parent_idx").on(table.parentId),
      // IVFFlat index is a good starting point for vector search performance.
      embeddingIdx: index("node_embedding_idx").on(table.embedding),
    }),
  );
  
  /**
   * A table to store hierarchical tags.
   * Tags are organized in a tree structure with parent-child relationships.
   */
  export const tags = pgTable("tags", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull().unique(),
    parentId: uuid("parent_id").references(() => tags.id),
  });
  
  /**
   * Junction table for the many-to-many relationship between assets and tags.
   */
  export const assetTags = pgTable(
    "asset_tags",
    {
      assetId: uuid("asset_id")
        .notNull()
        .references(() => assets.id, { onDelete: "cascade" }),
      tagId: uuid("tag_id")
        .notNull()
        .references(() => tags.id, { onDelete: "cascade" }),
      createdAt: timestamp("created_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    },
    (table) => ({
      pk: primaryKey({ columns: [table.assetId, table.tagId] }),
    }),
  );
  
  // --- Relations ---
  
  export const assetsRelations = relations(assets, ({ one, many }) => ({
    rootNode: one(nodes, {
      fields: [assets.rootNodeId],
      references: [nodes.id],
    }),
    nodes: many(nodes),
    tags: many(assetTags),
  }));
  
  export const nodesRelations = relations(nodes, ({ one, many }) => ({
    asset: one(assets, {
      fields: [nodes.assetId],
      references: [assets.id],
    }),
    parent: one(nodes, {
      fields: [nodes.parentId],
      references: [nodes.id],
    }),
    children: many(nodes, {
      relationName: "parent",
    }),
  }));
  
  export const tagsRelations = relations(tags, ({ one, many }) => ({
    parent: one(tags, {
      fields: [tags.parentId],
      references: [tags.id],
    }),
    children: many(tags, {
      relationName: "parent",
    }),
    assets: many(assetTags),
  }));
  
  export const assetTagsRelations = relations(assetTags, ({ one }) => ({
    asset: one(assets, {
      fields: [assetTags.assetId],
      references: [assets.id],
    }),
    tag: one(tags, {
      fields: [assetTags.tagId],
      references: [tags.id],
    }),
  }));
