-- Enable required extensions for MineCollect
-- This script runs automatically when the container starts for the first time

-- Enable the vector extension for similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable the ltree extension for hierarchical data
CREATE EXTENSION IF NOT EXISTS ltree;

-- Enable other useful extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create indexes that will be useful for the schema
-- These will be recreated by Drizzle migrations, but having them here ensures they exist

-- Verify extensions are installed
SELECT extname FROM pg_extension WHERE extname IN ('vector', 'ltree', 'uuid-ossp', 'pg_trgm'); 