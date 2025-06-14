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
  boolean,
  PgTableWithColumns,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// --- Custom Types for PostgreSQL-specific columns ---

/**
 * Custom Drizzle type for `pgvector`.
 * Assumes a vector of 1536 dimensions, standard for OpenAI embeddings.
 * The vector is stored as a string in the driver and parsed back into an array.
 */
// const vector = customType<{ data: number[]; driverData: string }>({
//   dataType() {
//     return "vector(1536)";
//   },
//   toDriver(value: number[]): string {
//     return `[${value.join(",")}]`;
//   },
//   fromDriver(value: string): number[] {
//     // Assumes the format is '[1,2,3]'
//     return value.slice(1, -1).split(",").map(Number);
//   },
// });

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
export const sources = pgTable(
  "sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // --- URI & Identification ---
    /**
     * The unique for the source, following the MineCollect URI schema.
     * e.g., 'https://www.youtube.com/watch?v=abc', 'app://twitter/user/status/123'
     * This is the primary key for identifying content across the system.
     */
    sourceUri: text("source_uri").notNull().unique(),

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

    addedAt: timestamp("added_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    // Indexes for common query patterns
    sourceUriIdx: index("source_uri_idx").on(table.sourceUri),
    timestampIdx: index("timestamp_idx").on(table.timestamp),
  }),
);

/**
 * Holds the individual nodes of content derived from a `source`.
 * Nodes are arranged in a tree structure with parent-child relationships.
 * This is the foundation for Retrieval-Augmented Generation (RAG).
 */
export const nodes: PgTableWithColumns<any> = pgTable(
  "nodes",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),

    /**
     * Reference to the parent node in the tree structure.
     * Null for root nodes.
     */
    parentId: uuid("parent_id").references(() => nodes.id, { onDelete: "cascade" }),

    // --- Content Organization ---
    /**
     * Hierarchical path for organizing the node, using ltree.
     * e.g., 'Snapshots.Tweets.Tech.12345', 'Readings.Articles.AI.NavalOnWealth'
     */
    path: ltree("path").notNull(),

    /**
     * The depth level in the tree (0 for root nodes).
     * Computed field to optimize tree queries.
     */
    depth: integer("depth").notNull().default(0),

    /**
     * Sequential order within siblings at the same level.
     */
    sortOrder: integer("sort_order").notNull().default(0),

    title: text("title"),

    content: text("content"),

    /**
     * Metadata specific to this node, e.g., { page: 3, paragraph: 2 }.
     */
    metadata: jsonb("metadata"),

    // --- Status ---
    /**
     * Whether this node is currently active or has been soft-deleted.
     */
    isActive: boolean("is_active").notNull().default(true),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    sourceIdx: index("node_source_idx").on(table.sourceId),
    // Index for ltree operations (will need GiST in migration)
    pathIdx: index("path_idx").on(table.path),
    parentIdx: index("node_parent_idx").on(table.parentId),
    isActiveIdx: index("node_is_active_idx").on(table.isActive),
    // Composite index for sibling ordering
    siblingOrderIdx: index("sibling_order_idx").on(table.parentId, table.sortOrder),
  }),
);

/**
 * A table to store hierarchical tags.
 * Tags are organized in a tree structure with parent-child relationships.
 */
export const tags: PgTableWithColumns<any> = pgTable(
  "tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    name: text("name").notNull(),

    /**
     * Optional description of what this tag represents.
     */
    description: text("description"),

    /**
     * Reference to parent tag for hierarchical organization.
     */
    parentId: uuid("parent_id").references(() => tags.id, { onDelete: "cascade" }),

    /**
     * Color hex code for UI display.
     */
    color: text("color"),

    /**
     * Whether this tag is currently active.
     */
    isActive: boolean("is_active").notNull().default(true),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    nameIdx: index("tag_name_idx").on(table.name),
    parentIdx: index("tag_parent_idx").on(table.parentId),
    isActiveIdx: index("tag_is_active_idx").on(table.isActive),
  }),
);

/**
 * Junction table for the many-to-many relationship between nodes and tags.
 * Allows more granular tagging at the node level.
 */
export const nodeTags = pgTable(
  "node_tags",
  {
    nodeId: uuid("node_id")
      .notNull()
      .references(() => nodes.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),

    /**
     * Optional confidence score for auto-generated tags.
     */
    confidence: integer("confidence"),

    /**
     * Whether this tag was applied manually or automatically.
     */
    isAutoGenerated: boolean("is_auto_generated").notNull().default(false),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.nodeId, table.tagId] }),
    nodeIdx: index("node_tags_node_idx").on(table.nodeId),
    tagIdx: index("node_tags_tag_idx").on(table.tagId),
    autoGeneratedIdx: index("node_tags_auto_idx").on(table.isAutoGenerated),
  }),
);

// --- Relations ---

export const sourcesRelations = relations(sources, ({ many }) => ({
  nodes: many(nodes),
}));

export const nodesRelations = relations(nodes, ({ one, many }) => ({
  source: one(sources, {
    fields: [nodes.sourceId],
    references: [sources.id],
  }),
  parent: one(nodes, {
    fields: [nodes.parentId],
    references: [nodes.id],
    relationName: "nodeHierarchy",
  }),
  children: many(nodes, {
    relationName: "nodeHierarchy",
  }),
  tags: many(nodeTags),
}));

export const tagsRelations = relations(tags, ({ one, many }) => ({
  parent: one(tags, {
    fields: [tags.parentId],
    references: [tags.id],
    relationName: "tagHierarchy",
  }),
  children: many(tags, {
    relationName: "tagHierarchy",
  }),
  nodes: many(nodeTags),
}));

export const nodeTagsRelations = relations(nodeTags, ({ one }) => ({
  node: one(nodes, {
    fields: [nodeTags.nodeId],
    references: [nodes.id],
  }),
  tag: one(tags, {
    fields: [nodeTags.tagId],
    references: [tags.id],
  }),
}));
