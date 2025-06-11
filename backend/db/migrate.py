#!/usr/bin/env python3
"""
Database migration script for MineCollect

Usage:
    python migrate.py init     # Initialize database and create all tables
    python migrate.py reset    # Drop and recreate all tables (WARNING: destructive)
    python migrate.py test     # Test database connection
"""

import sys
import argparse
from .config import db_config
from .schema import init_db, drop_tables, create_tables, MODELS

def init_database():
    """Initialize database with tables and extensions"""
    print("Initializing database...")
    
    # Test connection first
    if not db_config.test_connection():
        print("❌ Database connection failed!")
        return False
    
    try:
        # Setup pgvector extension
        db_config.setup_pgvector()
        
        # Initialize database schema
        init_db()
        
        print("✅ Database initialized successfully!")
        print(f"Created {len(MODELS)} tables:")
        for model in MODELS:
            print(f"  - {model._meta.table_name}")
        
        return True
        
    except Exception as e:
        print(f"❌ Database initialization failed: {e}")
        return False

def reset_database():
    """Drop and recreate all tables (WARNING: destructive)"""
    print("⚠️  WARNING: This will delete all data!")
    
    confirm = input("Type 'yes' to confirm: ")
    if confirm.lower() != 'yes':
        print("Operation cancelled.")
        return False
    
    try:
        print("Dropping all tables...")
        drop_tables()
        
        print("Recreating tables...")
        return init_database()
        
    except Exception as e:
        print(f"❌ Database reset failed: {e}")
        return False

def test_connection():
    """Test database connection"""
    print("Testing database connection...")
    
    if db_config.test_connection():
        print("✅ Database connection successful!")
        return True
    else:
        print("❌ Database connection failed!")
        return False

def main():
    parser = argparse.ArgumentParser(description='MineCollect Database Migration Tool')
    parser.add_argument('command', choices=['init', 'reset', 'test'],
                      help='Migration command to execute')
    
    args = parser.parse_args()
    
    if args.command == 'init':
        success = init_database()
    elif args.command == 'reset':
        success = reset_database()
    elif args.command == 'test':
        success = test_connection()
    else:
        print(f"Unknown command: {args.command}")
        success = False
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main() 