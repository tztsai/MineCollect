🧱 Phase 1: Infrastructure & Schema

Goal: Set up the backend environment, implement data model, and prepare for local ingestion.

1.1 Project Bootstrap
	•	Initialize a monorepo (e.g. with Turborepo).
	•	Set up backend/, desktop/, and mobile/ packages.
	•	Use PostgreSQL with pgvector and Drizzle ORM.

1.2 Implement Database Schema
	•	Create drizzle.config.ts, generate SQL migrations from the schema above.
	•	Apply schema to a local Postgres + pgvector instance.
	•	Add Revisions, Sources, Files, and ImportJobs tables with proper foreign keys.

1.3 Storage Setup
	•	Define local storage structure for media files (e.g. /var/minecollect/files).
	•	Enable media deduplication by hash.
	•	Optional: add file encryption layer.

⸻

📲 Phase 2: Ingestion System

Goal: Implement local folder watcher and ingestion processor.

2.1 Local Importer (File Watcher)
	•	Watch folders like ~/Screenshots, ~/Downloads, ~/Zotero.
	•	Use chokidar or equivalent to detect new files.
	•	Trigger an ingestion pipeline per new file.

2.2 Ingestion Pipeline
	•	Generate a unique content hash.
	•	Run OCR (Tesseract or cloud OCR fallback).
	•	Extract creation context (EXIF, file metadata).
	•	Assign source URI (e.g. device://MOBILE1234/Screenshots/file.png).
	•	Store in DB and attach to an item with embedded text + file reference.

2.3 Semantic Indexing
	•	Segment and embed content with OpenAI or local model.
	•	Insert vector into embedding column for semantic search.

⸻

🔌 Phase 3: REST API Layer

Goal: Build a minimal yet complete API layer to support ingestion, browsing, and querying.

3.1 Setup Server
	•	Choose Express or Fastify (recommend Fastify for performance).
	•	Scaffold modular API: items, files, search, import.

3.2 API Endpoints
	•	POST /api/items – Create new item
	•	GET /api/items – List/search items by tags, path
	•	GET /api/items/:id – Retrieve item details
	•	POST /api/import – Trigger importer manually
	•	GET /api/search?q= – Hybrid full-text + semantic search

3.3 Access Control (MVP)
	•	Use device-based access (e.g. via local IP or shared secret).
	•	No central auth; each instance trusts its own config.

⸻

🤳 Phase 4: Mobile App (React Native)

Goal: Support quick capture (text, screenshot, shared URL).

4.1 Mobile Client Setup
	•	Use Expo for rapid iteration.
	•	Setup a local HTTP client to send data to desktop API via local network.

4.2 Capture Features
	•	Quick Note (text + image)
	•	“Import by Sharing” (Android/iOS share target → POST to API)
	•	Capture metadata (app name, title, time)

4.3 Sync/Comm
	•	Scan LAN for active desktop node
	•	Fallback to manual IP entry

⸻

🖥️ Phase 5: Desktop App (Tauri)

Goal: Provide a UI to review and search the collected knowledge.

5.1 Tauri Setup
	•	Minimal frontend shell: sidebar (tree), search bar, detail panel
	•	Connect to local REST API

5.2 Tree Navigation
	•	Browse index tree /Mine, /Readings, /Media, etc.
	•	Filter by tags, sources

5.3 Item Detail
	•	Render markdown with embedded media
	•	Show metadata, source URI, edit tags

⸻

🔄 Phase 6: P2P Sync (Prototype)

Goal: Enable basic multi-device syncing.

6.1 Architecture
	•	Use WebRTC via libp2p or Yjs/WebRTC connector
	•	Devices discover each other via mDNS or QR code handshakes

6.2 Delta Sync
	•	Serialize new/updated items, files
	•	Sync periodically or on change
	•	Resolve conflicts via LWW or prompt user

⸻

🌐 Phase 7: Cloud Drive Import (Optional MVP Scope)

Goal: Enable ingestion from Google Drive, Dropbox, iCloud.

7.1 OAuth Integration
	•	Use API keys per user/device (stored in sources.auth)
	•	Mount folder access

7.2 Incremental Importer
	•	Poll or use webhook-style trigger
	•	Hash files, deduplicate, and import

⸻

🚀 MVP Done When…
	•	📱 Can capture notes/screenshots from mobile into desktop
	•	💾 Local ingestion from folders runs continuously
	•	🔍 Search and browse items semantically
	•	🧠 Items are semantically indexed with embeddings
	•	🌐 Files are associated with full source URI and retrievable
	•	📤 Can sync at least 2 devices over LAN via P2P
	•	🔒 All content stored locally, no external server
