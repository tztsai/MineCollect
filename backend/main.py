#!/usr/bin/env python3
"""
MineCollect Backend Main Application

FastAPI server entry point for the MineCollect backend.
"""

import os
import uvicorn
from fastapi import FastAPI, Depends, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import List, Optional
from contextlib import asynccontextmanager

from .db import init_db, db_config
from . import __version__


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Startup
    print("🚀 Starting MineCollect Backend...")
    
    # Initialize database
    if db_config.test_connection():
        print("✅ Database connection successful")
        init_db()
        print("✅ Database initialized")
    else:
        print("❌ Database connection failed!")
        raise Exception("Cannot connect to database")
    
    yield
    
    # Shutdown
    print("🛑 Shutting down MineCollect Backend...")


# Create FastAPI application
app = FastAPI(
    title="MineCollect API",
    description="AI-powered personal knowledge collector backend",
    version=__version__,
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Root endpoint with API info"""
    return {
        "name": "MineCollect API",
        "version": __version__,
        "status": "running",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    db_status = "ok" if db_config.test_connection() else "error"
    
    return {
        "status": "ok",
        "database": db_status,
        "version": __version__
    }


@app.get("/api/items")
async def list_items(
    q: Optional[str] = None,
    tags: List[str] = Query([]),
    path: Optional[str] = None,
    limit: int = 50,
    offset: int = 0
):
    """List/search items with filters"""
    # TODO: Implement actual item listing with database queries
    return {
        "items": [],
        "total": 0,
        "query": q,
        "tags": tags,
        "path": path,
        "limit": limit,
        "offset": offset
    }


@app.post("/api/items")
async def create_item(item_data: dict, background_tasks: BackgroundTasks):
    """Create new item manually"""
    # TODO: Implement item creation with content processing
    background_tasks.add_task(process_item_content, item_data)
    return {"status": "created", "id": "placeholder"}


@app.get("/api/items/{item_id}")
async def get_item(item_id: str):
    """Get item details"""
    # TODO: Implement item retrieval
    return {"id": item_id, "message": "Item retrieval not implemented yet"}


@app.post("/api/import")
async def trigger_import(source_type: str, background_tasks: BackgroundTasks):
    """Trigger manual import"""
    # TODO: Implement import triggering
    background_tasks.add_task(run_import, source_type)
    return {"status": "import_started", "source_type": source_type}


@app.get("/api/search")
async def hybrid_search(
    q: str,
    limit: int = 10,
    semantic_weight: float = 0.7
):
    """Hybrid full-text + semantic search"""
    # TODO: Implement hybrid search with embeddings
    return {
        "query": q,
        "results": [],
        "limit": limit,
        "semantic_weight": semantic_weight
    }


# Background task functions (placeholders)
async def process_item_content(item_data: dict):
    """Process item content with AI pipeline"""
    print(f"Processing item content: {item_data}")
    # TODO: Implement with Unstructured + Haystack


async def run_import(source_type: str):
    """Run import from specified source"""
    print(f"Running import from: {source_type}")
    # TODO: Implement import logic


def start_server():
    """Start the FastAPI server"""
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    reload = os.getenv("RELOAD", "true").lower() == "true"
    
    uvicorn.run(
        "backend.main:app",
        host=host,
        port=port,
        reload=reload,
        log_level="info"
    )


if __name__ == "__main__":
    start_server() 