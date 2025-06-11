# MineCollect Backend

## Features

- **FastAPI** - Modern, fast web framework for APIs
- **PostgreSQL + pgvector** - Vector database for semantic search
- **Unstructured** - Content processing and OCR
- **Haystack** - AI pipeline framework
- **Whisper** - Audio transcription
- **Playwright** - Web automation and scraping

## Installation

### Prerequisites

- Python 3.10+
- UV (Python package manager) - much faster than pip/poetry
- PostgreSQL with pgvector extension
- Redis (for background tasks)

### Setup

1. **Install UV** (if not already installed):
   ```bash
   curl -LsSf https://astral.sh/uv/install.sh | sh
   ```

2. **Install dependencies**:
   ```bash
   cd backend
   uv sync
   ```

3. **Setup environment variables**:
   ```bash
   cp env.example .env
   # Edit .env with your database credentials
   ```

4. **Initialize database**:
   ```bash
   uv run minecollect-migrate init
   ```

## Usage

### Development Server

Start the FastAPI development server:

```bash
uv run minecollect-server
```

Or using uvicorn directly:

```bash
uv run uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

### Database Management

```bash
# Initialize database
uv run minecollect-migrate init

# Test database connection
uv run minecollect-migrate test

# Reset database (WARNING: destructive)
uv run minecollect-migrate reset
```

### API Documentation

Once the server is running, visit:
- **Interactive API docs**: http://localhost:8000/docs
- **ReDoc docs**: http://localhost:8000/redoc
- **OpenAPI spec**: http://localhost:8000/openapi.json

## Environment Variables

Create a `.env` file in the backend directory:

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/minecollect
# OR individual components:
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=minecollect

# Server
HOST=0.0.0.0
PORT=8000
RELOAD=true

# AI Services
OPENAI_API_KEY=your_openai_key_here

# Redis (for background tasks)
REDIS_URL=redis://localhost:6379
```

## Development

### Code Quality

The project includes several code quality tools:

```bash
# Format code
uv run black .
uv run isort .

# Lint code
uv run flake8

# Type checking
uv run mypy backend

# Run tests
uv run pytest

# Run tests with coverage
uv run pytest --cov=backend
```

### Pre-commit Hooks

Install pre-commit hooks for automatic code formatting:

```bash
uv run pre-commit install
```

### UV-Specific Commands

```bash
# Add a new dependency
uv add fastapi

# Add a development dependency
uv add --dev pytest

# Remove a dependency
uv remove package-name

# Update all dependencies
uv sync --upgrade

# Show dependency tree
uv tree

# Create a virtual environment
uv venv

# Install only production dependencies
uv sync --no-dev
```

## API Endpoints

### Core Endpoints

- `GET /` - API information
- `GET /health` - Health check
- `GET /docs` - Interactive API documentation

### Items API

- `GET /api/items` - List/search items
- `POST /api/items` - Create new item
- `GET /api/items/{id}` - Get item details

### Import API

- `POST /api/import` - Trigger manual import

### Search API

- `GET /api/search` - Hybrid semantic search
