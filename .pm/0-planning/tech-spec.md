# MineCollect Technical Specification

## Tech Stack

- **Backend:** TypeScript
- **Frontend:** React
- **Database:** PostgreSQL
- **Search:** Meilisearch
- **Job Queue:** BullMQ
- **Scraping:** Playwright, crawlee, yt-dlp

---

## 🏗️ High-Level Architecture

```
┌───────────────┐     ┌──────────────┐     ┌───────────────┐     ┌───────────────┐
│   Scouts      │──▶  │  Normalizer  │──▶  │   Data Store  │──▶  │  Retriever    │
└──────┬────────┘     └──────┬───────┘     └──────┬────────┘     └──────┬────────┘
       │                     │                    │                     │
       ▼                     ▼                    ▼                     ▼
   Scheduler           Universal JSON       SQL & Vector DBs      Haystack RAG
      &                   Schema             (Postgres + ltree)    & Meilisearch
  Folder Watchers
       │
       ▼
    CLI/API
       │
       ▼
   Frontend/UI
```

### Data Flow
1. **Ingestion:** Connectors gather content from various sources
2. **Processing:** Content is normalized, chunked, and embedded
3. **Storage:** Hierarchical storage in PostgreSQL with vector embeddings
4. **Indexing:** Full-text and faceted search via Meilisearch
5. **Retrieval:** Hybrid search combining BM25 and vector similarity
6. **Presentation:** Results delivered via API to desktop/mobile clients

---

## 📂 Content Organization Schema

### Index Tree Structure
```
Mine/             # Authored notes, drafts, journals
Conversations/    # Participated AI chats, emails, messaging threads
Snapshots/        # Highlights, screenshots, images, tweets, quotes
Readings/         # Articles, papers, e-books, newsletters
Media/            # Video/audio with transcripts
Resources/        # GitHub stars, contacts, code snippets
Events/           # Saved future events (meetups, webinars)
```

### Node Path Examples
- `Snapshots.Highlights.BlogPost123.Paragraph2`
- `Readings.Articles.NavalOnWealth.Section3`
- `Conversations.ChatBots.GPT4.Chat2025.01`
- `Mine.Projects.MineCollect.Notes.Idea1`

### Hierarchical Tags
- `AI -> LLM -> RAG -> ragflow`
- `Technology -> Backend -> Database -> PostgreSQL`

---

## 🔧 System Components

### 1. Connectors & Authentication
**Purpose:** Gather content from diverse sources with secure credential management

**Components:**
- **Plugin Workers:** Isolated Python/Node.js processes per source
- **Scraping Libraries:** Playwright for complex UIs, yt-dlp, snscrape, crawlee, PRAW
- **API Integrations:** Readwise, Zotero, Kindle, various cloud services
- **Auth Management:** OAuth tokens & session cookies in encrypted vault (Hashicorp Vault / 1Password CLI)
- **Fallback Strategy:** Lightweight scrapers or manual import when APIs fail

**Supported Sources:**
- Local file watchers (screenshots, documents)
- Cloud drives (Drive, Dropbox, iCloud)
- Web services (YouTube, Twitter, RSS feeds)
- Reading platforms (Readwise, Kindle, Weread)
- Research tools (Zotero, academic papers)

### 2. Data Processing Pipeline
**Purpose:** Transform raw content into searchable, structured knowledge

**Processing Steps:**
1. **Partition & OCR:** unstructured.io + pdfminer/trafilatura + Tesseract/EasyOCR
2. **Semantic Chunking:** LLM-assisted segmentation with rule-based fallback
3. **Normalization:** Convert to universal JSON schema
4. **Deduplication:** Metadata + SimHash on embeddings
5. **Embedding Generation:** OpenAI text-embedding or sentence-transformers
6. **Tagging & Summarization:** Zero-shot classification + LLM summaries
7. **Indexing:** Store in PostgreSQL + Meilisearch

**Universal JSON Schema:**
```json
{
  "source": "string",
  "url": "string", 
  "title": "string",
  "timestamp": "datetime",
  "content_chunks": "array",
  "metadata": "object",
  "path": "ltree",
  "embeddings": "vector",
  "tags": "array"
}
```

### 3. Storage Layer
**Purpose:** Scalable, searchable storage with hierarchical organization

**Primary Database: PostgreSQL**
- **pgvector:** 256-1536 dimension embeddings
- **ltree:** Hierarchical paths with adjacent-list fallback
- **Full ACID compliance** for data integrity

**Search Engine: Meilisearch**
- **BM25 full-text search** with typo tolerance
- **Vector search** capabilities
- **Hierarchical facets** for filtering
- **Image search** with multimodal embeddings

**File Storage:**
- **Local:** Hashed folder structure
- **Cloud:** S3/GCS for scalability

**Alternative Vector Storage:**
- **Qdrant or Chroma** for large-scale embeddings if needed

### 4. Retrieval & QA System
**Purpose:** Intelligent search combining multiple retrieval methods

**Hybrid Search Pipeline:**
1. **Parallel Retrieval:** Meilisearch BM25 + pgvector similarity
2. **Score Normalization:** Min-max scaling for fair combination
3. **Reranking:** Optional binary reranker (Cohere/OpenAI)
4. **Context Assembly:** Dynamic parent-summary injection

**RAG Implementation:**
- **Framework:** Haystack with PostgreSQL DocumentStore
- **QA Pipeline:** Extractive QA with source citations
- **Context Management:** Token usage optimization
- **Fallback:** Lightweight extractive QA for performance

### 5. API & Interfaces
**Purpose:** Expose functionality through multiple interfaces

**FastAPI Backend:**
- **Async architecture** for high performance
- **Versioned OpenAPI** documentation
- **Strict typing** with mypy validation
- **Rate limiting** and authentication

**Desktop Application:**
- **Framework:** Tauri + React + Tailwind CSS + shadcn/ui
- **Features:** Dashboard with a grid of content sources, bulk import, search & chat UI, content management

**Mobile Application:**
- **Framework:** React Native + NativeWind
- **Features:** Quick capture, content sharing, mobile search

**CLI Tools:**
- **Framework:** Typer/Textual
- **Purpose:** Power user operations, debugging, bulk operations

### 6. Synchronization
**Purpose:** Real-time sync across devices with conflict resolution

**Sync Protocol:**
- **Transport:** WebRTC for P2P delta synchronization
- **Conflict Resolution:** CRDT (Automerge/Yjs) with manual merge UI
- **Revision History:** Audit logs and rollback capabilities

---

## 🔐 Security & Compliance

### Authentication & Authorization
- **Device-based tokens** with OAuth2 flows
- **Per-device ACLs** for granular access control
- **Rate limiting** to prevent abuse

### Data Protection
- **Secrets Management:** Vault or AWS Secrets Manager
- **Encryption:** TLS in transit, optional at-rest for PostgreSQL
- **GDPR Compliance:** Right to be forgotten endpoints with audit logs

---

## 🔍 Observability & Operations

### Monitoring & Logging
- **Structured Logging:** JSON format with OpenTelemetry
- **Metrics:** Prometheus + Grafana dashboards
- **Tracing:** Jaeger for distributed tracing
- **Error Tracking:** Sentry for exception monitoring

### Resilience
- **Retry Logic:** RabbitMQ or Redis Streams for failed tasks
- **Dead Letter Queues** for unrecoverable failures
- **Health Checks:** Readiness/liveness endpoints
- **Circuit Breakers** for external service failures

---

## 🚀 Deployment & Infrastructure

### Development Environment
- **Container Orchestration:** Docker Compose
- **Services:** PostgreSQL, Redis, FastAPI, Meilisearch, UI
- **Automation:** Scripts for build, migrations, tests

### Production Environment
- **Infrastructure as Code:** Terraform for cloud resources
- **Container Platform:** Kubernetes with Helm charts
- **CI/CD:** GitHub Actions with comprehensive testing
- **Feature Management:** LaunchDarkly or Unleash for safe rollouts

### CI/CD Pipeline
- **Code Quality:** Linting, type checks, security scans (Trivy)
- **Testing:** Unit, integration, and end-to-end tests
- **Deployment:** Canary releases with automated rollback

---

## 📋 Implementation Roadmap

### Phase 0: Foundation & DevEx (Weeks 1-4)
- **Core Infrastructure:** PostgreSQL setup with pgvector & ltree
- **Basic API:** FastAPI skeleton with Docker environment
- **Developer Experience:** Logging, tracing, performance dashboards
- **Feature Toggles:** Safe rollout infrastructure

### Phase 1: Core Ingestion (Weeks 5-8)
- **Primary Connectors:** Readwise, Screenshots, ChatGPT exports
- **Content Processing:** unstructured.io integration for PDF/HTML
- **Data Pipeline:** Normalization and storage workflow
- **Basic Search:** Meilisearch integration

### Phase 2: Intelligent Retrieval (Weeks 9-12)
- **Hybrid Search:** Meilisearch + pgvector combination
- **RAG Pipeline:** Haystack integration with extractive QA
- **LLM Integration:** Chunking and summarization
- **UI Foundation:** Basic React/Tauri interface

### Phase 3: Sync & Mobile (Weeks 13-16)
- **Desktop Application:** Full-featured Tauri app
- **Mobile MVP:** React Native with core features
- **P2P Sync:** WebRTC-based synchronization
- **Conflict Resolution:** CRDT implementation

### Phase 4: Scale & Polish (Weeks 17-20)
- **Additional Connectors:** WeChat, Zotero, advanced sources
- **Performance Optimization:** Caching, query optimization
- **Advanced Features:** Hierarchical facets, bulk operations
- **Production Readiness:** Kubernetes deployment, monitoring

### Phase 5: Intelligence Layer (Future)
- **Knowledge Graph:** Neo4j/Memgraph integration
- **Proactive Agents:** Suggestions, reminders, insights
- **Embeddable Widgets:** Integration with other tools
- **Advanced Analytics:** Usage patterns, content insights

---

## 🎛️ Configuration & Customization

### Environment Variables
- **Database:** Connection strings, pooling settings
- **External Services:** API keys, rate limits
- **Feature Flags:** Toggle experimental features
- **Performance:** Batch sizes, timeout values

### User Customization
- **Source Priorities:** Weight different content types
- **Processing Rules:** Custom chunking and tagging logic
- **Search Preferences:** Ranking algorithms, result formatting
- **Sync Settings:** Frequency, conflict resolution strategies