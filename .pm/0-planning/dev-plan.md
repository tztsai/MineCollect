🧱 Phase 1: Infrastructure & Schema

Goal: Set up the Python backend environment, implement data model, and prepare for AI-powered content processing.

1.1 Project Bootstrap
	•	Initialize a monorepo with Python backend + TypeScript frontends.
	•	Set up packages: backend/, apps/desktop, apps/mobile.
	•	Use PostgreSQL with pgvector and SQLAlchemy ORM.
	•	Configure Docker Compose for development environment.

1.2 Database Schema (PostgreSQL + pgvector)
	•	Create SQLAlchemy models with pgvector support.
	•	Generate Alembic migrations for schema deployment.
	•	Implement Items, Files, Sources, ImportJobs, Logs, Errors, Revisions tables.
	•	Add vector similarity indexes for semantic search.

1.3 FastAPI Backend Setup
	•	Initialize FastAPI application with async support.
	•	Configure CORS for frontend communication.
	•	Set up background task system with Celery + Redis.
	•	Implement basic health check and API structure.

1.4 Content Processing Foundation
	•	Integrate Unstructured.io for document partitioning and OCR.
	•	Set up Haystack pipelines for embedding generation.
	•	Configure OpenAI client for LLM-based tagging.
	•	Implement Whisper for audio transcription.

⸻

📲 Phase 2: AI-Powered Ingestion System

Goal: Implement intelligent content processing with local folder watching and AI enhancement.

2.1 Local File Watcher (Python)
	•	Watch folders: ~/Screenshots, ~/Downloads, ~/Documents/Zotero.
	•	Use watchdog library for cross-platform file monitoring.
	•	Trigger async ingestion pipeline per new file.

2.2 Smart Ingestion Pipeline
	•	Generate SHA-256 content hash for deduplication.
	•	Process with Unstructured (hi-res OCR, document partitioning).
	•	Extract metadata (EXIF, file properties, source context).
	•	Generate embeddings via Haystack + OpenAI.
	•	LLM-based auto-tagging and keyword extraction.
	•	Store in PostgreSQL with vector indexing.

2.3 Content Processing Workers
	•	Async background jobs for CPU-intensive tasks.
	•	Batch processing for multiple files.
	•	Progress tracking and error handling.
	•	Retry mechanisms for failed processing.

⸻

🔌 Phase 3: FastAPI Backend & Search

Goal: Build high-performance API with hybrid semantic + full-text search.

3.1 Core API Endpoints
	•	POST /api/items – Create/import new content
	•	GET /api/items – List with filtering (tags, path, date)
	•	GET /api/items/{id} – Retrieve item with full metadata
	•	POST /api/import – Trigger manual import jobs
	•	GET /api/search – Hybrid semantic + full-text search
	•	WebSocket endpoints for real-time updates

3.2 Advanced Search Implementation
	•	pgvector cosine similarity for semantic search.
	•	PostgreSQL full-text search for exact matches.
	•	Hybrid scoring with configurable weights.
	•	Search result ranking and relevance scoring.

3.3 Secret Management & Configuration
	•	Secure vault for API keys (OpenAI, OAuth tokens).
	•	Environment-based configuration.
	•	Encrypted storage for sensitive credentials.

⸻

🎨 Phase 4: Modern Frontend (React + Vite + shadcn/ui)

Goal: Build elegant desktop interface for browsing and managing knowledge.

4.1 Frontend Foundation
	•	React + Vite + TypeScript setup.
	•	Tailwind CSS + shadcn/ui component library.
	•	TanStack Query for server state management.
	•	React Router for navigation.

4.2 Core UI Components
	•	SearchCommand with semantic search (⌘K interface).
	•	ItemTree for hierarchical browsing (/Mine, /Readings, etc.).
	•	ItemDetail with markdown rendering and metadata.
	•	TagManager for content organization.

4.3 Advanced Features
	•	Real-time updates via WebSocket.
	•	Drag-and-drop file import.
	•	Keyboard shortcuts and power-user features.
	•	Dark/light theme support.

⸻

🤳 Phase 5: Mobile App (React Native + NativeWind)

Goal: Quick capture and mobile access to knowledge base.

5.1 Mobile Foundation
	•	React Native + NativeWind (Tailwind for RN).
	•	React Navigation for screen management.
	•	Native modules for device integration.

5.2 Capture Features
	•	Quick text/voice note capture.
	•	Share target integration (iOS/Android).
	•	Camera integration for document scanning.
	•	Voice-to-text with Whisper transcription.

5.3 Mobile-Specific Features
	•	Offline-first with sync queue.
	•	Auto-discovery of desktop instances (mDNS).
	•	Background sync when connected to WiFi.

⸻

🌐 Phase 6: Web Content Importers (Playwright)

Goal: Automated import from web sources and cloud services.

6.1 Web Automation Framework
	•	Playwright for browser automation.
	•	Persistent browser sessions with cookie management.
	•	Rate limiting and respectful scraping practices.

6.2 Source Connectors
	•	YouTube (watch history, liked videos, subscriptions).
	•	Readwise (highlights and annotations).
	•	Twitter/X (bookmarks, likes).
	•	Reddit (saved posts and comments).
	•	Email (Gmail, Outlook with OAuth).

6.3 Cloud Drive Integration
	•	Google Drive API with OAuth 2.0.
	•	Dropbox API integration.
	•	Incremental sync with change detection.

⸻

🔄 Phase 7: P2P Sync (libp2p/WebRTC)

Goal: Enable secure multi-device synchronization without central server.

7.1 P2P Architecture
	•	libp2p for peer discovery and communication.
	•	WebRTC for direct device-to-device sync.
	•	mDNS for local network discovery.

7.2 Sync Protocol
	•	Delta synchronization with conflict resolution.
	•	Last-write-wins with manual override UI.
	•	Incremental sync for large files.
	•	End-to-end encryption between devices.

7.3 Multi-Device Management
	•	Device registration and trust management.
	•	Selective sync (choose what to sync).
	•	Bandwidth-aware sync prioritization.

⸻

🚀 MVP Success Criteria

Core Functionality:
	•	📱 Mobile quick capture → desktop knowledge base
	•	💾 Continuous local folder ingestion with AI processing
	•	🔍 Sub-second semantic search across all content
	•	🧠 Automatic tagging with >85% relevance (LLM-powered)
	•	🌐 Web import from 3+ major sources (YouTube, Readwise, etc.)

Technical Requirements:
	•	📊 Handle 10,000+ items with fast search performance
	•	🔄 P2P sync between 2+ devices (desktop, mobile)
	•	🔒 Fully self-hosted, no external dependencies
	•	⚡ Real-time UI updates and background processing
	•	🎯 Modern, responsive UI with keyboard shortcuts

Quality Metrics:
	•	🎨 Beautiful, intuitive interface (shadcn/ui design system)
	•	⚡ <200ms API response times for search
	•	🛡️ Robust error handling and recovery
	•	📱 Native mobile experience with offline capability
	•	🔧 Easy setup with Docker Compose
