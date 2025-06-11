import uuid
from datetime import datetime
from typing import Optional, List
from peewee import *
from playhouse.postgres_ext import PostgresqlExtDatabase, JSONField, ArrayField
from pgvector.peewee import VectorField
from .config import db_config

# Get database instance from configuration
db = db_config.get_database()

class BaseModel(Model):
    """Base model class that all models inherit from"""
    class Meta:
        database = db

class Labels(BaseModel):
    """Labels/tags for categorizing items"""
    id = UUIDField(primary_key=True, default=uuid.uuid4)
    name = TextField(null=False)
    color = CharField(max_length=32, null=False)
    parent = ForeignKeyField('self', null=True, on_delete='SET NULL')
    
    class Meta:
        table_name = 'labels'

class Items(BaseModel):
    """Core content items in the knowledge database"""
    id = UUIDField(primary_key=True, default=uuid.uuid4)
    source = TextField(null=False)  # URI-like source, e.g. mine://ideas/...
    path = TextField(null=False)    # e.g. /Readings/Articles/...
    content = TextField(null=True)  # Markdown content
    embedding = VectorField(dimensions=1536, null=True)  # Vector embeddings
    type = CharField(max_length=32, null=False)  # e.g. note, highlight, screenshot
    labels = ArrayField(UUIDField, null=True)  # Array of label UUIDs
    links = ArrayField(UUIDField, null=True)   # Array of linked item UUIDs
    parent = ForeignKeyField('self', null=True, on_delete='SET NULL')
    created_at = DateTimeField(default=datetime.utcnow)
    updated_at = DateTimeField(default=datetime.utcnow)
    metadata = JSONField(null=True)  # Additional metadata
    
    class Meta:
        table_name = 'items'
    
    def save(self, *args, **kwargs):
        """Override save to update timestamp"""
        self.updated_at = datetime.utcnow()
        return super().save(*args, **kwargs)

class Channels(BaseModel):
    """Channels for importing/exporting data from external sources"""
    id = UUIDField(primary_key=True, default=uuid.uuid4)
    scheme = CharField(max_length=64, null=False)  # e.g. zotero, gdrive, reddit
    auth = JSONField(null=True)    # Authentication tokens, cookies, etc.
    config = JSONField(null=True)  # User configuration like directory, etc.
    
    class Meta:
        table_name = 'channels'

class ImportJobs(BaseModel):
    """Import job tracking and status"""
    id = UUIDField(primary_key=True, default=uuid.uuid4)
    channel = ForeignKeyField(Channels, null=True, on_delete='SET NULL')
    config = JSONField(null=True)  # Job-specific configuration
    status = CharField(max_length=32, default='pending')  # pending, success, error
    logs = JSONField(null=True)    # Job execution logs
    created_at = DateTimeField(default=datetime.utcnow)
    last_run_at = DateTimeField(null=True)
    
    class Meta:
        table_name = 'import_jobs'

class ExportJobs(BaseModel):
    """Export job tracking and status"""
    id = UUIDField(primary_key=True, default=uuid.uuid4)
    channel = ForeignKeyField(Channels, null=True, on_delete='SET NULL')
    config = JSONField(null=True)  # Job-specific configuration
    status = CharField(max_length=32, default='pending')  # pending, success, error
    logs = JSONField(null=True)    # Job execution logs
    created_at = DateTimeField(default=datetime.utcnow)
    last_run_at = DateTimeField(null=True)
    
    class Meta:
        table_name = 'export_jobs'

class Rules(BaseModel):
    """Rules for automated processing and categorization"""
    id = UUIDField(primary_key=True, default=uuid.uuid4)
    name = TextField(null=False)
    description = TextField(null=True)
    created_at = DateTimeField(default=datetime.utcnow)
    updated_at = DateTimeField(default=datetime.utcnow)
    
    class Meta:
        table_name = 'rules'
    
    def save(self, *args, **kwargs):
        """Override save to update timestamp"""
        self.updated_at = datetime.utcnow()
        return super().save(*args, **kwargs)

# Model registry for easy access
MODELS = [
    Labels,
    Items,
    Channels,
    ImportJobs,
    ExportJobs,
    Rules
]

def create_tables():
    """Create all database tables"""
    with db:
        db.create_tables(MODELS)

def drop_tables():
    """Drop all database tables"""
    with db:
        db.drop_tables(MODELS)

def connect_db():
    """Connect to the database"""
    return db.connect()

def close_db():
    """Close database connection"""
    if not db.is_closed():
        db.close()

# Database initialization
def init_db():
    """Initialize database with tables and indexes"""
    connect_db()
    create_tables()
    
    # Create vector similarity index for embeddings
    # Note: This requires pgvector extension to be installed
    try:
        db.execute_sql("""
            CREATE INDEX IF NOT EXISTS items_embedding_idx 
            ON items USING ivfflat (embedding vector_cosine_ops)
        """)
    except Exception as e:
        print(f"Warning: Could not create vector index: {e}")
    
    close_db()

if __name__ == "__main__":
    # Initialize database when run directly
    init_db()
    print("Database schema created successfully!") 