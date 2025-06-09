🧭 PRINCIPLES

1. Unified but Filterable View

Let the user see everything at once, but filter by source, time, tag, or type.

2. Time and Context are Key

Support temporal review (What did I collect this week?) and thematic clustering (What do I know about ‘cyberpunk economics’?)

3. Fast, Fluid, Visual

Browsing is cognitive; the UI must support rapid preview, tagging, and relational discovery without friction.

4. Modular Semantics

Let users pivot between views: timeline, graph, mindmap, list, search, thread.

⸻

🖼️ HIGH-LEVEL UI LAYOUT (RESEARCH COCKPIT)

┌──────────────────────────── Sidebar ─────────────────────────────┐
│  Sources [✔ YouTube ✔ Kindle ✔ Reddit ...]                      │
│  Types   [✔ Highlights ✔ Screenshots ✔ Bookmarks ...]           │
│  Tags    [#ai, #health, #web3]                                   │
│  Date    [Last 7 days | This month | Range picker]              │
└──────────────────────────────────────────────────────────────────┘
┌──── Search & Controls ─────┐     ┌──────────── View Modes ───────────────────────┐
│🔍 [ AI + Keyword Search  ] │     │  ☐ Directory Tree ☐ Timeline ☐ Semantic Graph │
└────────────────────────────┘     └───────────────────────────────────────────────┘

┌─────────────────────────── Main Content Area ──────────────────────────────┐
│ ☐ [ ] Screenshot from 2024-01-12            [🕒] [Tags] [📁 Folder]         │
│ ☐ [ ] YouTube Video: “Stuart Russell on AI” [🕒] [Tags] [📁 Folder]         │
│ ☐ [ ] Reddit Comment on XYZ topic          [🕒] [Tags] [📁 Folder]         │
│ ☐ [ ] Kindle Note from “Godel Escher Bach” [🕒] [Tags] [📁 Folder]         │
│ ...                                                                         │
└────────────────────────────────────────────────────────────────────────────┘


⸻

🧩 FUNCTIONAL MODULES (Components)

1. Search Panel (Hybrid)
	•	🔍 Full-text + semantic search (embedding-powered)
	•	Support natural language queries (e.g. “Show me everything I collected about ‘loneliness’ this winter”)
	•	Filters: Source, type, tag, date

2. Content Viewer Panel
	•	Dynamically loads content previews: snippet, image (if screenshot), summary (if long), tags
	•	“Open original” / “Copy to composer” / “Edit tags” / “Mark for review”

3. AI Assistant Sidebar
	•	Suggests:
	•	Related items
	•	Clusters
	•	Summary of selected items
	•	Actions: “Generate outline”, “Compare these two items”

4. Review Modes

Each of these modes enhances cognition differently:

Mode	Purpose
🗃 List	Fast skimming & batch actions
🕒 Timeline	Temporal awareness & daily review
🧠 Mindmap	Thematic linking & big-picture view
🧵 Thread	Review by thought-line or source
🌐 Graph	Semantic network between concepts

Use react-flow, vis.js, or cytoscape.js for graphs/mindmaps.

5. Tagging + Folders
	•	Quick tagging with AI suggestions
	•	Drag into folders or “buckets”
	•	Show tag clouds / auto-categorization

⸻

🔁 WORKFLOW DESIGN

A well-designed UI should encourage a review loop:
	1.	Ingested Today → Quick View Queue
	2.	Daily/Weekly Review Mode → 🕒 Timeline + 🔖 Tag/Link/Compose
	3.	Push to “Topics” or “Projects”
	4.	Research Mode → 🧠 Search + Compare + Summarize
	5.	Compose Mode → Send selected items to Ruminer or external markdown editor

⸻

🔧 IMPLEMENTATION STACK

Area	Technology
Frontend	Next.js + Tailwind + ShadCN
State mgmt	Zustand / Redux Toolkit
Visual modes	react-flow, recharts, vis.js
Search backend	Meilisearch + optional ChromaDB
REST API
AI	OpenAI / local LLM (llama.cpp)

⸻

🧪 INNOVATIVE IDEAS
	•	“Attention Heatmap”: Visualize what sources dominate your attention
	•	“Personal Zeitgeist”: Weekly digest of your mind
	•	“Context Snapshots”: Save semantic clusters as notebooks
	•	“Resonance Score”: Auto-score items based on attention history + semantic similarity
