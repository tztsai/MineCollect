# MineCollect: Phased Development Plan

This document outlines the implementation roadmap for MineCollect, breaking down the project into discrete phases. It aligns with the architecture defined in the `tech-spec.md` and incorporates ideas from across the project documentation.

---

### 🚀 Phase 0: Foundation & Developer Experience (Weeks 1-4)
**Goal:** Establish the core infrastructure, database schema, and development environment. This phase prioritizes a solid foundation for all subsequent work.

- **1.1 Project Scaffolding:**
  - Initialize a monorepo structure for `backend` and `frontend` packages.
  - Set up Docker Compose to orchestrate PostgreSQL, Redis, and Meilisearch services.
  - Implement basic logging, tracing (OpenTelemetry), and configuration management.

- **1.2 Database & Schema:**
  - Configure PostgreSQL with `pgvector` and `ltree` extensions.
  - Define core SQLAlchemy models: `Items`, `Chunks`, `Sources`, `Tags`.
  - Set up Alembic for database migrations.

- **1.3 Backend API:**
  - Initialize a FastAPI application with async support.
  - Implement a background task runner (e.g., Celery with Redis).
  - Create initial health check and placeholder API endpoints.

- **1.4 Security:**
  - Set up secret management using Hashicorp Vault or a similar tool for API keys and credentials.

---

### 📥 Phase 1: Core Ingestion & Processing (Weeks 5-8)
**Goal:** Build the primary data pipeline, enabling content ingestion from local files and basic web sources.

- **2.1 Local File Ingestion:**
  - Implement a local folder watcher using `watchdog` to monitor user-specified directories (e.g., `~/Screenshots`, `~/Downloads`).
  - Trigger ingestion jobs for new or modified files.

- **2.2 Content Processing Pipeline:**
  - Integrate `unstructured.io` for robust document partitioning (PDF, HTML, etc.) and OCR.
  - Generate SHA-256 content hashes for deduplication.
  - Extract file metadata (EXIF, timestamps).
  - Persist processed content and metadata to PostgreSQL.

- **2.3 First Connectors:**
  - Build initial connectors for high-value sources like Readwise (highlights) and basic web page scraping.

---

### 🧠 Phase 2: Intelligent Retrieval & Search (Weeks 9-12)
**Goal:** Enrich the ingested data with AI-powered features and build a powerful hybrid search API.

- **3.1 AI Enrichment:**
  - Integrate an embedding pipeline using `sentence-transformers` or OpenAI's API.
  - Implement LLM-based auto-tagging and summarization for content chunks.
  - Store embeddings in `pgvector` and tags/summaries in PostgreSQL.

- **3.2 Hybrid Search API:**
  - Set up Meilisearch and create an indexing pipeline to mirror PostgreSQL data.
  - Implement a search endpoint in FastAPI that combines:
    - **Keyword Search:** Full-text search from Meilisearch.
    - **Semantic Search:** Cosine similarity from `pgvector`.
  - Develop a scoring mechanism to merge and rank results from both engines.

- **3.3 Core API Endpoints:**
  - Build out full CRUD (Create, Read, Update, Delete) endpoints for items and tags.
  - Implement robust filtering and pagination.

---

### 🖥️ Phase 3: Desktop UI & User Experience (Weeks 13-16)
**Goal:** Create a functional and beautiful desktop application for interacting with the knowledge base.

- **4.1 Frontend Foundation:**
  - Set up a Tauri application with React, Vite, and TypeScript.
  - Integrate Tailwind CSS and `shadcn/ui` for the component library.
  - Use TanStack Query for efficient server-state management.

- **4.2 Core UI Components:**
  - **Command Palette (⌘K):** A fast, keyboard-driven interface for search.
  - **Hierarchical View:** A tree-based navigator for browsing content by its `ltree` path.
  - **Detail View:** A component to render item content, metadata, and tags.
  - **Tag Management:** An interface for creating, editing, and applying tags.

- **4.3 API Integration:**
  - Connect all UI components to the FastAPI backend.
  - Implement WebSocket support for real-time UI updates.

---

### 📱 Phase 4: Mobile & Sync (Weeks 17-20)
**Goal:** Extend access to mobile devices and implement the first version of P2P synchronization.

- **5.1 Mobile Application:**
  - Set up a React Native project using NativeWind for styling.
  - Implement quick-capture features: text notes, photo/document scanning, and share sheet integration.
  - Design a mobile-first interface for search and review.

- **5.2 P2P Synchronization:**
  - Design the architecture for P2P sync using WebRTC or `libp2p`.
  - Implement device discovery on local networks (mDNS).
  - Develop an initial delta-sync protocol with a last-write-wins conflict resolution strategy.

---

### 🌐 Phase 5: Advanced Connectors & Scalability (Weeks 21-24)
**Goal:** Expand data sources to complex web platforms and ensure the system is robust and scalable.

- **6.1 Advanced Web Connectors:**
  - Build browser automation-based importers using Playwright for sources like:
    - YouTube (history, liked videos)
    - Twitter/X (bookmarks, likes)
    - Reddit (saved posts)
  - Implement respectful scraping practices with appropriate rate limiting.

- **6.2 Cloud & API Connectors:**
  - Add importers for cloud drives (Google Drive, Dropbox) using their official APIs.
  - Integrate with other key services like Zotero.

- **6.3 System Resilience:**
  - Introduce message queues (RabbitMQ/Redis Streams) for ingestion tasks to improve retry logic and fault tolerance.
  - Enhance monitoring with Prometheus/Grafana dashboards.

---

### ✨ Phase 6: Intelligence Layer & Polish (Future)
**Goal:** Move beyond simple retrieval to proactive knowledge synthesis and advanced intelligence features.

- **7.1 Advanced RAG:**
  - Refine the QA pipeline to inject parent/child context into LLM prompts for more accurate answers.
  - Implement an extractive QA fallback for speed and citation accuracy.

- **7.2 Knowledge Graph:**
  - Explore building a knowledge graph (e.g., with Neo4j) from entities and tags to surface hidden connections.

- **7.3 Proactive Agents:**
  - Design and prototype agents that can provide unsolicited suggestions, create automated summaries, or identify related content.

---

### ✅ MVP Success Criteria

The Minimum Viable Product is complete when a user can:
- **Capture:** Automatically ingest content from local folders (screenshots) and at least one key web source (e.g., Readwise).
- **Process:** Have that content automatically OCR'd, chunked, embedded, and tagged.
- **Search:** Use the desktop UI to perform hybrid keyword/semantic search and get relevant results in <500ms.
- **Review:** Browse their knowledge base through the hierarchical tree and view individual items.
- **Sync:** Capture a note on the mobile app and see it appear on the desktop app via P2P sync.