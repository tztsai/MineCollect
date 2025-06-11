"""
MineCollect Database Package

This package contains the database schema, configuration, and migration tools
for the MineCollect application using Peewee ORM with PostgreSQL and pgvector.
"""

from .config import db_config
from .schema import (
    # Models
    Items,
    Labels, 
    Channels,
    ImportJobs,
    ExportJobs,
    Rules,
    
    # Database functions
    init_db,
    create_tables,
    drop_tables,
    connect_db,
    close_db,
    
    # Model registry
    MODELS
)

__all__ = [
    'db_config',
    'Items',
    'Labels',
    'Channels', 
    'ImportJobs',
    'ExportJobs',
    'Rules',
    'init_db',
    'create_tables',
    'drop_tables',
    'connect_db',
    'close_db',
    'MODELS'
] 