### **🏗️ Architecture Outline**

This design prioritizes type-safety, developer experience, and clear separation of concerns.

```mermaid
graph TD
    subgraph "MineCollect System"
        direction LR

        subgraph "Clients"
            C1[Desktop App (Tauri + React)];
            C2[CLI (Typer/Textual)];
        end

        subgraph "TypeScript Backend (Modular Monolith)"
            direction TB
            API[Hono API w/ tRPC];
            Workers[Background Workers (BullMQ + Redis)];
            DB[(PostgreSQL w/ pgvector & ltree)];

            API --> DB;
            Workers --> DB;
            C1 --> API;
            C2 --> API;
        end

        subgraph "Python AI Services (Sidecars)"
            direction TB
            S1[Processor (unstructured.io)];
            S2[Embedder (sentence-transformers)];
            S3[RAG (Haystack)];
        end

        Workers -- REST Call --> S1;
        Workers -- REST Call --> S2;
        API -- REST Call --> S3;
    end
```
*   **Clients (Desktop/CLI):** Communicate via tRPC for end-to-end type-safe data fetching and mutations.
*   **TypeScript Backend:** The system's core. It handles all standard CRUD operations, authentication, job queuing, and direct interaction with the database. It is the single source of truth for data. Managed using a monorepo with Turbo and pnpm workspaces.

---

### **Component Breakdown**

We will adopt the excellent structure from `karakeep` as our foundation, adapting it for `MineCollect`'s specific needs.

```
/minecollect
├── apps/
│   ├── cli/             # Typer + Textual CLI
│   ├── mobile/          # React Native frontend
│   ├── desktop/         # Tauri + React frontend
│   ├── workers/         # BullMQ background workers for ingestion
├── packages/
│   ├── api/             # Hono server exposing the tRPC router
│   ├── db/              # Drizzle ORM schema for PostgreSQL
│   │   └── schema.ts    # The single source of truth for our data model
│   ├── trpc/            # tRPC routers, defining all API procedures
│   │   └── routers/
│   │       └── item.ts  # Example router for 'items'
│   └── shared/          # Shared utilities and types
└── ...                  # turbo.json, pnpm-workspace.yaml, etc.
```

---

### **Code Samples**

Here are some examples of what the key components would look like.

#### 1. Database Schema (`packages/db/schema.ts`)

This Drizzle schema is the heart of our application, defining the structure of our data in PostgreSQL.

#### 2. tRPC Router (`packages/trpc/routers/item.ts`)

This defines a type-safe API endpoint for fetching items, which the frontend can call as if it were a local function.

```typescript
import { z } from "zod";
import { db } from "@minecollect/db";
import { items } from "@minecollect/db/schema";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { like } from "drizzle-orm";

export const itemRouter = createTRPCRouter({
  search: publicProcedure
    .input(z.object({ query: z.string() }))
    .query(async ({ input }) => {
      // Basic full-text search example
      return await db.query.items.findMany({
        where: like(items.displayContent, `%${input.query}%`),
        limit: 50,
      });
    }),

  // More procedures here: create, getById, etc.
});
```

#### 3. Ingestion Worker (`apps/workers/connectors/twitter.ts`)

A background job processor that fetches data from a source, queues it for processing, and handles potential failures.

```typescript
import { Worker } from "bullmq";
import { playwright } from "playwright";
import { db } from "@minecollect/db";
import { items } from "@minecollect/db/schema";
// Assume redis connection is configured elsewhere

const twitterWorker = new Worker("ingestion-queue", async (job) => {
  if (job.name === "fetch-twitter-bookmarks") {
    const { userId, sessionCookies } = job.data;
    
    // 1. Use Playwright to scrape bookmarks (as per your spec)
    const newBookmarks = await scrapeBookmarks(sessionCookies);

    // 2. In a transaction, add them to the database
    await db.transaction(async (tx) => {
      for (const bookmark of newBookmarks) {
        // Here you'd compute the hash, create the URI, etc.
        await tx.insert(items).values({ ... }).onConflictDoNothing();
      }
    });

    // 3. Queue follow-up jobs for embedding
    // await embeddingQueue.add("embed-new-items", { ... });
  }
}, { connection: redis });
```

---

### **🎨 UI/UX Notes**

*   **Frameworks:** Your choice of **Tauri + React + Tailwind CSS + shadcn/ui** is perfect. It's modern, performant, and produces beautiful, accessible interfaces.
*   **Design Tone:** Keep it **minimal, elegant, and text-focused**. The UI should feel like a serene library, not a busy dashboard. Use ample white space, strong typography, and a muted color palette.
*   **Key Interactions:**
    1.  **Command-K Palette:** A global command palette is essential for a power-user tool. It should allow searching, running commands (`Sync Readwise`), and navigating.
    2.  **Unified Search Bar:** The primary UI element should be a single input that seamlessly handles keyword search, natural language questions (RAG), and filtering (`source:twitter`).
    3.  **Source Dashboard:** A clean grid showing each connected data source, its sync status (`Last synced: 5 minutes ago`), and the number of new items. This builds user trust and provides clear feedback.
    4.  **Content View:** Use a multi-column layout to show the hierarchy (`ltree` path), the list of items, and the selected item's content + metadata.

---

### **✅ Final Review Checklist**

Here are the trade-offs of this design and a checklist for success.

*   **Trade-offs:**
    *   **Hybrid Complexity:** Managing two languages and the interface between them (API calls from TS to Python) adds operational overhead compared to a single-stack solution. **Justification:** The power and maturity of Python's AI libraries (`unstructured.io`, `sentence-transformers`) far outweigh this complexity.
    *   **Monorepo vs. Microservices:** We are choosing a modular monolith over full microservices. This is simpler to manage for a small team, as you don't have to deal with complex service discovery or a distributed data backbone for the MVP.

*   **Hidden Complexity to Watch For:**
    *   **The `metadata` Column:** The `jsonb` field is flexible but can become a "junk drawer." Enforce structure by validating its contents with Zod schemas before insertion.
    *   **Ingestion Logic:** Scraping is brittle. Each connector needs robust error handling, retry logic (which BullMQ provides), and clear state management (`crawling`, `failed`, `success`).
    *   **Migrations:** As you evolve the schema, ensure `drizzle` migrations are handled carefully, especially with custom types like `ltree` and `vector`.

*   **Builder's Checklist:**
    1.  [ ] **Initialize the Project:** Set up the Turborepo with pnpm workspaces.
    2.  [ ] **Define the Core Schema:** Implement `packages/db/schema.ts` first. This is your foundation.
    3.  [ ] **Build the First Connector:** Create a worker for an easy, API-based source like Readwise to prove the ingestion pipeline.
    4.  [ ] **Implement the tRPC API:** Expose a `search` and `getById` endpoint.
    5.  [ ] **Develop the Basic UI:** Create a Tauri app that can call the tRPC endpoints and display items.
    6.  [ ] **Integrate Python Services:** Containerize the Python `embedder` service and have the TypeScript worker call it after a new item is ingested.