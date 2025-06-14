# MineCollect Ingestion

This package contains the ingestion system for MineCollect, responsible for gathering content from various sources and importing it into the database.

## Architecture

The ingestion system is built around the concept of "scouts" - specialized workers that know how to extract content from specific sources. Each scout uses Playwright for browser automation to access and extract content.

### Key Components

- **Scouts**: Specialized workers for different content sources
- **Queue**: Rate-limited job queue for processing content
- **Database**: Storage for extracted content

## Available Scouts

### YouTube Scout

Extracts video metadata and transcripts from YouTube videos.

```bash
# Run the YouTube scout
npm run scout:youtube -- https://www.youtube.com/watch?v=VIDEO_ID
```

### ChatGPT Scout

Extracts conversations from ChatGPT.

```bash
# Run the ChatGPT scout (requires manual login)
npm run scout:chatgpt
```

## Development

### Adding a New Scout

1. Create a new file in `src/scouts/` that extends the `BaseScout` class
2. Implement the required methods:
   - `onInitialize()`: Scout-specific initialization
   - `onExecute()`: Main extraction logic
   - `onCleanup()`: Scout-specific cleanup
3. Export the scout in `src/index.ts`

### Testing

```bash
# Run tests
npm test
```

## License

MIT 