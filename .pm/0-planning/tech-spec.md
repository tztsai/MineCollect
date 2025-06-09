# MineCollect – Technical Specification (v0.1)

## 🧭 Overview

**MineCollect** is a fully self-hosted, P2P-synced personal knowledge collector that continuously ingests content from cloud/local sources into a structured and queryable database. It supports mobile-first quick capture and desktop-based universal review and research.

---

## 🛠️ Tech Stack

* **Backend**

  * **Database**: PostgreSQL + Drizzle ORM + pgvector
  * **Sync/Comms**: P2P (libp2p / WebRTC-based custom sync layer)
  * **Importers**: Local watchers, cloud sync, API fetchers, share targets
  * **Search & Embedding**: pgvector + OpenAI/LLM-based embedding
  * **API**: REST API (via Express or Fastify) exposed to mobile + desktop clients

* **Frontend**

  * **Desktop App**: Tauri (Rust + web frontend)
  * **Mobile App**: React Native (Expo or Bare)

* **Cloud Drive Integration**: Polling + webhook-style incremental import from iCloud, Dropbox, Google Drive

---

## 📂 Index Tree Structure

The index tree forms the semantic core of the knowledge database:

```
/MineCollect
├── Mine/             # Authored by user (notes, drafts, journals)
├── Dialogues/        # Conversations (chatbots, threads, emails)
├── Snapshots/        # Glanceable saves (highlights, screenshots, clips)
├── Readings/         # Articles and documents (PDF, EPUB, MD, etc.)
├── Media/            # Videos, podcasts, images (metadata + transcript)
├── Resources/        # Github stars, tools, job links
├── Events/           # Time-based actions (calendars, meetups)
```

The `System/` folder (raw imports, logs, errors) is **external** to this structure, managed separately as technical metadata.

---

## 🧱 Backend Modules

### 1. **Database Design (Drizzle + PostgreSQL + pgvector)**

* `Items` (core table)

  * `id`: UUID
  * `path`: index tree path (e.g. `/Readings/Articles/2025-06-08-title-slug`)
  * `source`: source URI in the customized scheme of MineCollect
  * `content`: Markdown format string
  * `embedding`: VECTOR (pgvector)
  * `tags`: string\[]
  * `created_at`, `updated_at`

* `Files`

  * `id`, `item_id`, `type` (image, pdf, audio, etc.)
  * `filepath`
  * `metadata`: JSONB (OCR results, thumbnails, etc.)

* `Sources`

  * `id`, `type`, `auth` (tokens, cookies), `settings`

* `Logs`, `Errors`, `ImportJobs`

### 2. **P2P Sync Module**

* Uses WebRTC/libp2p for device-to-device sync
* Syncs both DB deltas and media file diffs
* Each device maintains its own encrypted data vault

### 3. **Importers**

#### a. Local Importers

* Watch selected folders: `~/Screenshots`, `~/Documents/Zotero`, etc.
* On file creation:

  * Perform OCR
  * Generate hash to prevent duplicates
  * Infer metadata (source app, creation context)
  * Trigger semantic chunking + embedding

#### b. Cloud Drives

* OAuth + folder polling for:

  * Google Drive
  * Dropbox
  * iCloud (indirectly via desktop iCloud Drive mount)

#### c. Web Importers

* API or scraping-based:

  * YouTube (watch history, liked videos)
  * Reddit (saved posts/comments)
  * Twitter/X (likes/bookmarks)
  * Readwise (highlights)
  * Kindle (clippings.txt or Amazon API)

#### d. Share Target (Mobile)

* Handle shared text, links, files
* Extract metadata
* Prompt for tagging or path placement

### 4. **Embedding & Semantic Indexing**

* Every ingest triggers a background job:

  * Clean + segment content
  * Generate embeddings via API or local LLM
  * Store in `embedding` field
  * Indexed in pgvector

---

## 🌐 REST API

* `POST /api/items` — Add item manually
* `GET /api/items` — List/query items (filters, tags, path)
* `GET /api/items/:id` — Full item detail
* `POST /api/import` — Trigger on-demand import
* `GET /api/search` — Full-text + semantic hybrid search

> Mobile + desktop clients communicate with the REST API layer, which wraps DB access and importer controls.

---

## 🔐 Auth & Security

* All data remains local (fully offline-capable)
* Authentication is device-based (no central server)
* Encryption at rest (file + DB layer optional)
* Optional password vault for APIs/cookies

---

## 🔄 Sync & Versioning

* P2P sync tracks deltas across items + files
* Conflict resolution: last-write-wins + manual override UI
* Snapshots per item revision stored in `Revisions` table

---

## 📍 Next Steps

1. Finalize Drizzle schema based on above structure
2. Set up local folder watcher for screenshots and Zotero
3. Implement core REST endpoints
4. Prototype embedding + semantic search
5. Design sync layer + mobile share target handler
