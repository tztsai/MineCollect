- contents are stored in nodes in a tree structure:
  - content (the content of an intermediate node is (title and) summary of its children)
  - embedding (the embedding of an intermediate node is pooled from its children)
  - children (a list of children nodes)
- a node with long content can be "decomposed" into a subtree of nodes
- the reader visualizes the tree structure with expand(details)/collapse(summary) actions
- in RAG, a retrieved node is provided to the LLM with its context (parent nodes)
- tags also can be hierarchical, i.e. a tag can have subtags


•	Python or Node.js workers – great for scripting scrapers and APIs.
•	Playwright or Selenium – for UI scraping (e.g. WeChat).
•	youtube-dl or yt-dlp – for YouTube metadata and downloads.
•	snscrape – for scraping Twitter/X.
•	Reddit API – or use PRAW.
•	[Kindle highlights via Amazon or Readwise API]
•	WeChat – extremely tricky; explore:
    •	WeChat for Web + Playwright automation
    •	Local storage folder scraping if using PC WeChat
•	Zotero – use Zotero local DB or Zotero API


Use a job scheduler to regularly sync data:
	•	cron + Airflow or Dagster – for more orchestration.
	•	Simple solution: Python’s schedule or Node’s node-cron
Each job can:
	•	Pull latest data
	•	Run normalizer
	•	Store to DB
	•	Log errors


Authentication:
	•	Store OAuth tokens/passwords securely in a .env or config file
	•	Use keyring or encrypted vault like 1Password CLI or Hashicorp Vault for sensitive info
	•	Enable persistent sessions with cookies (pickle browser session cookies)


UI / CLI / Monitoring
	•	CLI (initially): Rich TUI with Textual or Typer
	•	Minimal Dashboard: Build with Next.js or Astro for visualizing ingested data
	•	Logging & Alerting: Use Sentry or self-hosted logtail or Prometheus + Grafana if scaling.


For local folders (screenshots, Zotero folders, etc.):
	•	Use watchdog in Python or chokidar in Node.js
	•	Automatically extract text via Tesseract OCR:
	•	Auto-tagging and keyword extraction with LLM


•	Semantic Deduplication (e.g., remove near-duplicate content)
•	Attention-Based Prioritization: Rank items you’re likely to revisit or compose with.
•	Zero-shot classification for auto-tagging and keyword extraction (sparse embeddings)
•	Semantic deduplication: via sentence embeddings and cosine similarity
•	Personal context embeddings (fine-tuning via contrastive learning) for long-term user modeling
