# MineCollect Web UI

A minimal web UI for inspecting the sources and nodes in the MineCollect database.

## Features

- View all sources in the database
- Inspect source metadata
- Browse hierarchical node content
- View original content via external links

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Development

This is a Next.js application that connects directly to the MineCollect database to display imported content.

### Key Files

- `app/page.tsx` - Home page that lists all sources
- `app/sources/[id]/page.tsx` - Source detail page that shows source metadata and content nodes
- `app/layout.tsx` - Root layout with navigation

## Building for Production

```bash
npm run build
npm run start
``` 