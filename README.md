# MineCollect

A universal content collector with conversational search in your personal digital space

⸻

1. Introduction

In an age of accelerating digital distractions, MineCollect provides a unified foundation to capture, structure, and surface your personal information footprint. More than a mere data aggregator, it transforms scattered highlights, articles, chats, and media into a coherent, searchable “second brain,” enabling deeper knowledge work and on-demand insight via conversational AI.

⸻

2. Key Features
	•	Unified Interface: One place for every piece of collected content—web clippings, notes, transcripts, bookmarks.
	•	Hierarchical Organization: Automatic tagging and tree-structured paths for intuitive browsing (e.g., Readings.Articles.SenecaOnVirtue).
	•	Hybrid Search: Seamless blend of keyword (BM25) and semantic similarity engines for both precision and recall.
	•	AI-Powered Q&A: RAG pipelines with extractive fallback ensure accurate, citation-rich answers.
	•	Cross-Device Capture & Review: Browser extensions, mobile share targets, folder watchers, and CLI make collection frictionless.

⸻

3. Architectural Overview

┌───────────────┐     ┌──────────────┐     ┌────────────────┐     ┌───────────────┐
│   Connectors  │──▶  │  Normalizer  │──▶  │   Data Store   │──▶  │  Retriever    │
└──────┬────────┘     └──────┬───────┘     └──────┬─────────┘     └──────┬────────┘
       │                     │                    │                    │
       ▼                     ▼                    ▼                    ▼
 Scheduler            Universal JSON       SQL & Vector DBs      QA & Search
 & Watchers               Schema            (Postgres + pgvector) (Haystack, Meili)
       │
       ▼
    CLI/API
       │
       ▼
   Frontend/UI

⸻

4. Core Components

4.1 Connectors

Each source (RSS, YouTube, Kindle, WeChat, Zotero, local folders) is handled by an isolated, stateless worker. Authentication (OAuth or cookies) is managed securely, with API-first fallbacks to scraping when needed.

4.2 Ingestion & Normalizer

Raw inputs are mapped into a universal JSON schema—with fields such as source, url, title, tags, content_chunks, and metadata. This uniformity underpins consistent downstream processing.

4.3 Data Store & Indexing
	•	Primary Storage: PostgreSQL with pgvector for embeddings and ltree for hierarchy (with adjacent-list fallback for extremely deep trees).
	•	Full-Text Index: Meilisearch (or TypeSense) for BM25-powered queries, typo tolerance, and hierarchical filters.
	•	Vector Store: Chroma or Qdrant as scale-ready options if embedded vectors outgrow Meili.

4.4 Scheduler & Folder Watchers

A lightweight orchestration layer (cron or Airflow/Dagster) triggers connector runs, normalizes data, and writes to the database. Local folders (screenshots, Zotero libraries) are observed via file watchers to ingest new files in real time.

4.5 Retriever & QA
	•	Hybrid Retrieval: Merges keyword and semantic scores, then reranks top results.
	•	Conversational Q&A: Haystack pipelines inject parent-node summaries into LLM prompts; extractive QA serves as a low-latency, citation-accurate fallback.

4.6 Interface Layer
	•	CLI (Typer/Textual) for power users.
	•	Web/Mobile (Tauri + React; React Native) for broad accessibility.
	•	Monitoring & Alerts: Sentry for errors; Prometheus + Grafana for health and performance metrics.

⸻

5. Development Strategy
	•	Modularity: Independent evolution of connectors, pipelines, and UIs.
	•	Extensibility: Plug-and-play architecture welcomes new data sources without rework.
	•	Schema Coherence: Uniform data model simplifies processing and search.
	•	Skeptical Engineering: Start narrow, prove value, then generalize—avoiding over-engineering up front.

⸻

6. Conclusion

MineCollect is not just an aggregator—it is the foundational layer in a personal metacognitive stack. By persistently organizing every digital trace into a structured archive, it empowers AI-driven search, synthesis, and decision-making. In the coming era of personalized intelligence, such an architecture will be indispensable—transforming digital entropy into actionable knowledge.

⸻

License

This project is licensed under the Apache License 2.0.