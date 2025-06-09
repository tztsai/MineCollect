# MineCollect – Comprehensive Technical Specification

## 🧭 Overview

**MineCollect** is a fully self-hosted, AI-powered personal knowledge collector that continuously ingests content from cloud and local sources into a structured, searchable database. It supports mobile-first quick capture and desktop-based universal review and research with P2P synchronization.

MineCollect serves as a **universal content harvester** for your digital footprint, handling authentication persistence, data normalization, intelligent processing, storage, indexing, and cross-device sync.

---

## 🛠️ Tech Stack

### **Backend & AI Processing**
- **API Framework**: FastAPI (async, high-performance Python)
- **Database**: PostgreSQL + pgvector (vector similarity search)
- **Content Processing**: self-hosted unstructured package (partitioning, cleaning, chunking, OCR, etc., integrated into Haystack framework)
- **RAG Framework**: Haystack with MCP integration
- **Audio Processing**: Whisper (speech-to-text transcription, integrated into Haystack framework)
- **Web Automation**: Playwright (browser automation for complex sources)
- **Secret Management**: Environment variables for OAuth tokens and API keys
- **Orchestration**: Docker Compose for development and deployment

### **Frontend**
- **Desktop App**: Tauri + React + Tailwind CSS
- **Mobile App**: React Native + NativeWind
- **Build Tool**: Vite (fast development and building)
- **UI Components**: shadcn/ui (modern, accessible component library)

### **P2P & Sync**
- **Sync Protocol**: libp2p in TypeScript

---

## 🏗️ High-Level Architecture

```
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│   Connectors    │──▶│   Processor     │──▶│   Data Store    │
│ (Playwright,    │   │ (Haystack)      │   │ (PostgreSQL +   │
│  APIs, Watch)   │   │                 │   │  pgvector)      │
└─────────┬───────┘   └─────────┬───────┘   └─────────┬───────┘
          ▼                     ▼                     ▼
    ┌──────────┐          ┌──────────┐          ┌──────────┐
    │Scheduler │          │AI Pipeline│         │Search API│
    │(Cron +   │          │(Embeddings│         │(Semantic │
    │ Queue)   │          │LLM Tagging)│        │ + Vector)│
    └──────────┘          └──────────┘          └──────────┘
          ▲                     ▲                     ▲
          │                     │                     │
    ┌─────▼─────────────────────▼─────────────────────▼─────┐
    │                FastAPI Backend                       │
    │            (REST API + WebSocket)                    │
    └─────────────────────┬─────────────────────────────────┘
                          │
    ┌─────────────────────▼─────────────────────────────────┐
    │                P2P Sync Layer                        │
    │         (libp2p/WebRTC device sync)                  │
    └─────────────────────┬─────────────────────────────────┘
                          │
    ┌─────────────────────▼─────────────────────────────────┐
    │     Frontend Clients (React/React Native)            │
    └───────────────────────────────────────────────────────┘
```

---

## 📂 Index Tree Structure

The index tree forms the semantic core of the knowledge database:

```
/MineCollect
├── Mine/             # Authored content (notes, drafts, journals)
│   ├── Ideas/        # Random thoughts and notes
│   ├── Journal/      # Daily notes and reflections
│   └── Projects/     # Work and personal projects
├── Conversations/    # Conversations (chatbots, threads, emails)
│   ├── ChatBots/     # AI conversations
│   ├── Emails/       # Important email threads
│   └── Messages/     # Text/chat conversations (e.g. WhatsApp, Telegram)
├── Snapshots/        # Short captures (highlights, screenshots, clips)
│   ├── Screenshots/  # Screen captures with OCR
│   ├── Highlights/   # Text selections from various sources
│   └── Comments/     # Short comments on social media
├── Readings/         # Articles and documents (PDF, EPUB, MD, etc.)
│   ├── Articles/     # Web articles and blog posts
│   ├── Papers/       # Academic papers and research
│   └── Books/        # E-books and longer content
├── Media/            # Videos, podcasts, images (metadata + transcript)
│   ├── Videos/       # Video content with transcripts (e.g. YouTube)
│   ├── Podcasts/     # Audio content with transcripts (e.g. Audible)
│   └── Images/       # Photos and graphics with descriptions (e.g. Instagram, Pinterest)
├── Resources/        # Tools, links, references
│   ├── Tools/        # GitHub stars
│   ├── Contacts/     # Important contacts (LinkedIn, Email, etc.)
│   └── Scripts/      # Code snippets (e.g. Gists)
├── Events/           # Time-based content (e.g. EventBrite, Meetup, Facebook Events)
```

---

### 2. **Content Processing Pipeline (Unstructured + Haystack)**

```python
# Content processing workflow
class ContentProcessor:
    def __init__(self):
        self.unstructured = UnstructuredClient()
        self.haystack_pipeline = self._build_pipeline()
        self.llm_client = OpenAIClient()
    
    def process_content(self, source_path: str, content_type: str):
        # 1. Extract and partition content
        elements = self.unstructured.partition(
            filename=source_path,
            strategy="hi_res",  # High resolution for better OCR
            chunking_strategy="by_title"
        )
        
        # 2. Clean and chunk
        chunks = self._clean_and_chunk(elements)
        
        # 3. Generate embeddings
        embeddings = self.haystack_pipeline.run({
            "texts": [chunk.content for chunk in chunks]
        })
        
        # 4. LLM-based tagging and keyword extraction
        tags_keywords = self._extract_tags_keywords(chunks)
        
        # 5. Store in database
        return self._store_processed_content(chunks, embeddings, tags_keywords)
    
    def _extract_tags_keywords(self, chunks):
        prompt = """
        Analyze the following content and extract:
        1. 3-5 relevant tags (categories/topics)
        2. 5-10 important keywords or keyphrases
        
        Content: {content}
        
        Respond in JSON format:
        {
            "tags": ["tag1", "tag2", ...],
            "keywords": ["keyword1", "keyword2", ...]
        }
        """
        
        return self.llm_client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt.format(content=chunks)}]
        )
```


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

> Mobile + desktop clients communicate with the REST API layer, which wraps DB access and importer controls.

---

## 🔐 Auth & Security

* All data remains local (fully offline-capable)
* Authentication is device-based (no central server)
* Encryption at rest (file + DB layer optional)

---

## 🔄 Sync & Versioning

* P2P sync tracks deltas across items + files
* Conflict resolution: last-write-wins + manual override UI
* Snapshots per item revision stored in `Revisions` table

### 3. **Data Connectors**

#### **Local Importers**
```python
# File system watcher
class LocalWatcher:
    def __init__(self):
        self.watch_dirs = [
            "~/Screenshots",
            "~/Downloads", 
            "~/Documents/Zotero",
            "~/Desktop"
        ]
        self.processor = ContentProcessor()
    
    async def start_watching(self):
        async for changes in aiofiles.watch(*self.watch_dirs):
            for change in changes:
                if change.action == "create":
                    await self._process_new_file(change.path)
    
    async def _process_new_file(self, filepath):
        # OCR, hash generation, metadata extraction
        content_hash = self._generate_hash(filepath)
        
        if not self._is_duplicate(content_hash):
            # Process with Unstructured
            processed = await self.processor.process_content(filepath, "file")
            
            # Infer source context (which app created it)
            source_context = self._infer_source_context(filepath)
            
            # Store in database
            await self._store_item(processed, source_context)
```

#### **Web Importers (Playwright)**
```python
# Web content extraction
class WebImporter:
    def __init__(self):
        self.browser = None
        self.processor = ContentProcessor()
    
    async def import_youtube_history(self, credentials):
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page()
            
            # Login and navigate
            await self._login_youtube(page, credentials)
            await page.goto("https://www.youtube.com/feed/history")
            
            # Extract video data
            videos = await page.evaluate("""
                () => Array.from(document.querySelectorAll('#video-title')).map(
                    el => ({
                        title: el.textContent,
                        url: el.href,
                        timestamp: el.closest('.ytd-video-meta-block').querySelector('#metadata-line').textContent
                    })
                )
            """)
            
            # Process each video
            for video in videos:
                await self._process_video(video)
            
            await browser.close()
```

#### **API-based Importers**
```python
# Readwise integration
class ReadwiseImporter:
    def __init__(self, api_token):
        self.api_token = api_token
        self.client = httpx.AsyncClient()
    
    async def import_highlights(self):
        highlights = await self._fetch_all_highlights()
        
        for highlight in highlights:
            processed = await self.processor.process_content(
                content=highlight['text'],
                metadata={
                    'book_title': highlight['book_title'],
                    'author': highlight['author'],
                    'source_url': highlight['source_url'],
                    'highlighted_at': highlight['highlighted_at']
                }
            )
            
            await self._store_highlight(processed, highlight)
```

### 4. **AI Processing Pipeline (Haystack + LLM)**

```python
# Haystack pipeline configuration
from haystack import Pipeline
from haystack.components.embedders import OpenAITextEmbedder
from haystack.components.writers import DocumentWriter

def build_processing_pipeline():
    pipeline = Pipeline()
    
    # Add components
    pipeline.add_component("embedder", OpenAITextEmbedder(model="text-embedding-ada-002"))
    pipeline.add_component("writer", DocumentWriter(document_store=PostgreSQLDocumentStore()))
    
    # Connect components
    pipeline.connect("embedder.embedding", "writer.embedding")
    
    return pipeline

# Whisper integration for audio transcription
class AudioProcessor:
    def __init__(self):
        self.whisper_model = whisper.load_model("base")
    
    async def transcribe_audio(self, audio_path: str):
        result = self.whisper_model.transcribe(audio_path)
        return {
            'text': result['text'],
            'segments': result['segments'],
            'language': result['language']
        }
```

### 5. **FastAPI Application Structure**

```python
# Main FastAPI application
from fastapi import FastAPI, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="MineCollect API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Routes
@app.post("/api/items")
async def create_item(item_data: ItemCreate, background_tasks: BackgroundTasks):
    """Create new item manually"""
    background_tasks.add_task(process_item_content, item_data)
    return await items_service.create(item_data)

@app.get("/api/items")
async def list_items(
    q: str = None,
    tags: List[str] = Query([]),
    path: str = None,
    limit: int = 50,
    offset: int = 0
):
    """List/search items with filters"""
    return await items_service.search(
        query=q, tags=tags, path=path, limit=limit, offset=offset
    )

@app.get("/api/items/{item_id}")
async def get_item(item_id: UUID):
    """Get item details"""
    return await items_service.get_by_id(item_id)

@app.post("/api/import")
async def trigger_import(source_type: str, background_tasks: BackgroundTasks):
    """Trigger manual import"""
    background_tasks.add_task(run_import, source_type)
    return {"status": "import_started"}

@app.get("/api/search")
async def hybrid_search(
    q: str,
    limit: int = 10,
    semantic_weight: float = 0.7
):
    """Hybrid full-text + semantic search"""
    return await search_service.hybrid_search(q, limit, semantic_weight)
```

---

## 🎨 Frontend Architecture

### **Desktop App (Tauri + React + Vite + Tailwind + shadcn/ui)**

```typescript
// Main application structure
import { useState, useEffect } from 'react'
import { SearchCommand } from '@/components/search-command'
import { ItemTree } from '@/components/item-tree'
import { ItemDetail } from '@/components/item-detail'
import { useQuery } from '@tanstack/react-query'

function App() {
  const [selectedItem, setSelectedItem] = useState<string | null>(null)
  
  const { data: items } = useQuery({
    queryKey: ['items'],
    queryFn: () => api.getItems()
  })

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-80 border-r">
        <SearchCommand />
        <ItemTree 
          items={items} 
          onSelect={setSelectedItem}
        />
      </div>
      
      {/* Main content */}
      <div className="flex-1">
        {selectedItem ? (
          <ItemDetail itemId={selectedItem} />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Select an item to view</p>
          </div>
        )}
      </div>
    </div>
  )
}
```

### **Mobile App (React Native + NativeWind)**

```typescript
// Mobile app structure
import { NavigationContainer } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { CaptureScreen } from './screens/CaptureScreen'
import { SearchScreen } from './screens/SearchScreen'
import { BrowseScreen } from './screens/BrowseScreen'

const Tab = createBottomTabNavigator()

export default function App() {
  return (
    <NavigationContainer>
      <Tab.Navigator>
        <Tab.Screen 
          name="Capture" 
          component={CaptureScreen}
          options={{
            tabBarIcon: ({ focused }) => (
              <PlusIcon className={focused ? "text-primary" : "text-gray-400"} />
            )
          }}
        />
        <Tab.Screen name="Search" component={SearchScreen} />
        <Tab.Screen name="Browse" component={BrowseScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  )
}

// Quick capture screen
function CaptureScreen() {
  const [content, setContent] = useState('')
  const [tags, setTags] = useState<string[]>([])
  
  const handleCapture = async () => {
    await api.createItem({
      content,
      tags,
      path: '/Mine/Quick',
      source: 'mobile://quick-capture'
    })
    
    // Show success and clear form
    setContent('')
    setTags([])
  }
  
  return (
    <View className="flex-1 p-4 bg-white">
      <TextInput
        className="border border-gray-300 rounded-lg p-3 h-32"
        multiline
        placeholder="Capture your thoughts..."
        value={content}
        onChangeText={setContent}
      />
      
      <TagInput tags={tags} onTagsChange={setTags} />
      
      <Button 
        className="mt-4 bg-blue-500 rounded-lg p-3"
        onPress={handleCapture}
      >
        <Text className="text-white text-center font-semibold">Capture</Text>
      </Button>
    </View>
  )
}
```

---

## 🔄 P2P Sync Architecture

### **Sync Protocol**
```python
# P2P sync implementation
class P2PSyncNode:
    def __init__(self, device_id: str):
        self.device_id = device_id
        self.libp2p_node = None
        self.sync_state = SyncState()
    
    async def start_sync_node(self):
        # Initialize libp2p node
        self.libp2p_node = await create_libp2p_node(
            transports=[WebRTCTransport()],
            muxers=[Mplex()],
            security=[Noise()],
            protocols=[SyncProtocol()]
        )
        
        # Start listening for connections
        await self.libp2p_node.listen(["/ip4/0.0.0.0/tcp/0/ws"])
    
    async def sync_with_peer(self, peer_id: str):
        # Exchange sync states
        local_state = await self._get_local_sync_state()
        peer_state = await self._request_peer_sync_state(peer_id)
        
        # Calculate diff
        diff = self._calculate_sync_diff(local_state, peer_state)
        
        # Exchange data
        await self._exchange_sync_data(peer_id, diff)
        
        # Resolve conflicts
        await self._resolve_conflicts(diff.conflicts)
```

---

## 🚀 Deployment & Development

### **Docker Compose Setup**
```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: pgvector/pgvector:pg15
    environment:
      POSTGRES_DB: minecollect
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  backend:
    build: ./packages/backend
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/minecollect
      REDIS_URL: redis://redis:6379
    depends_on:
      - postgres
      - redis
    volumes:
      - ./data:/app/data

  frontend:
    build: ./packages/frontend
    ports:
      - "3000:3000"
    depends_on:
      - backend

volumes:
  postgres_data:
```

### **Development Scripts**
```json
{
  "scripts": {
    "dev": "docker-compose up -d && concurrently \"npm run dev:backend\" \"npm run dev:frontend\"",
    "dev:backend": "cd packages/backend && uvicorn main:app --reload --host 0.0.0.0 --port 8000",
    "dev:frontend": "cd packages/frontend && vite dev",
    "build": "docker-compose build",
    "test": "pytest packages/backend/tests && npm run test:frontend",
    "migrate": "cd packages/backend && alembic upgrade head"
  }
}
```

---

## 🔐 Security & Configuration

### **Secret Management**
```python
# Secure configuration management
class SecretManager:
    def __init__(self):
        self.vault = {}
        self._load_secrets()
    
    def _load_secrets(self):
        # Load from environment or encrypted store
        self.vault = {
            'openai_api_key': os.getenv('OPENAI_API_KEY'),
            'youtube_oauth': self._decrypt_secret('youtube_oauth'),
            'readwise_token': self._decrypt_secret('readwise_token'),
        }
    
    def get_secret(self, key: str) -> str:
        return self.vault.get(key)
    
    def store_secret(self, key: str, value: str):
        encrypted_value = self._encrypt_secret(value)
        # Store in secure location
        self._save_encrypted_secret(key, encrypted_value)
```

---

## 📍 Implementation Roadmap

### **Phase 1: Core Infrastructure** ✅
- [ ] PostgreSQL + pgvector setup
- [ ] FastAPI application structure
- [ ] Basic content processing with Unstructured
- [ ] Docker development environment

### **Phase 2: Content Processing** 🔄
- [ ] Unstructured integration for multiple file types
- [ ] Haystack pipeline setup
- [ ] LLM-based tagging and keyword extraction
- [ ] Whisper audio transcription

### **Phase 3: Data Ingestion** 📋
- [ ] Local folder watchers
- [ ] Playwright-based web importers
- [ ] API-based importers (Readwise, Twitter, etc.)
- [ ] Mobile share target implementation

### **Phase 4: Search & UI** 📋
- [ ] Hybrid search implementation
- [ ] React frontend with shadcn/ui
- [ ] React Native mobile app
- [ ] Real-time sync interface

### **Phase 5: P2P Sync** 📋
- [ ] libp2p/WebRTC implementation
- [ ] Conflict resolution system
- [ ] Multi-device testing
- [ ] Encryption and security

---

## 🎯 Success Metrics

- **📱 Mobile**: Can capture notes/screenshots from mobile into desktop
- **💾 Local**: Continuous ingestion from folders runs automatically  
- **🔍 Search**: Semantic search with sub-second response times
- **🧠 AI**: Automatic tagging with >85% relevance
- **🌐 Sync**: Reliable P2P sync between 2+ devices
- **🔒 Privacy**: All content stored locally, no external dependencies 