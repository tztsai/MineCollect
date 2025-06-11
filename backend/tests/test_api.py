"""
Tests for the FastAPI application
"""

import pytest
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)


def test_root_endpoint():
    """Test the root endpoint"""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "MineCollect API"
    assert "version" in data
    assert data["status"] == "running"


def test_health_endpoint():
    """Test the health check endpoint"""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "version" in data
    assert "database" in data


def test_list_items_endpoint():
    """Test the list items endpoint"""
    response = client.get("/api/items")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert data["total"] == 0  # Empty initially


def test_list_items_with_params():
    """Test the list items endpoint with query parameters"""
    response = client.get("/api/items?q=test&tags=work&limit=10&offset=0")
    assert response.status_code == 200
    data = response.json()
    assert data["query"] == "test"
    assert data["tags"] == ["work"]
    assert data["limit"] == 10
    assert data["offset"] == 0


def test_create_item_endpoint():
    """Test the create item endpoint"""
    item_data = {
        "content": "Test content",
        "path": "/Mine/Test",
        "source": "test://manual"
    }
    response = client.post("/api/items", json=item_data)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "created"
    assert "id" in data


def test_get_item_endpoint():
    """Test the get item endpoint"""
    response = client.get("/api/items/test-id")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "test-id"


def test_search_endpoint():
    """Test the search endpoint"""
    response = client.get("/api/search?q=test query")
    assert response.status_code == 200
    data = response.json()
    assert data["query"] == "test query"
    assert "results" in data
    assert data["limit"] == 10  # default
    assert data["semantic_weight"] == 0.7  # default


def test_import_endpoint():
    """Test the import trigger endpoint"""
    response = client.post("/api/import?source_type=readwise")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "import_started"
    assert data["source_type"] == "readwise" 