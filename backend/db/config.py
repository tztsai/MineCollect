import os
from typing import Optional
from playhouse.postgres_ext import PostgresqlExtDatabase

class DatabaseConfig:
    """Database configuration and connection management"""
    
    def __init__(self):
        self.database_url = os.getenv('DATABASE_URL')
        self.db_name = os.getenv('DB_NAME', 'minecollect')
        self.db_user = os.getenv('DB_USER', 'postgres')
        self.db_password = os.getenv('DB_PASSWORD', 'postgres')
        self.db_host = os.getenv('DB_HOST', 'localhost')
        self.db_port = int(os.getenv('DB_PORT', '5432'))
        
        self._db: Optional[PostgresqlExtDatabase] = None
    
    def get_database(self) -> PostgresqlExtDatabase:
        """Get or create database connection"""
        if self._db is None:
            if self.database_url:
                # Use DATABASE_URL if provided (for production/containerized environments)
                self._db = PostgresqlExtDatabase(self.database_url)
            else:
                # Use individual components
                self._db = PostgresqlExtDatabase(
                    self.db_name,
                    user=self.db_user,
                    password=self.db_password,
                    host=self.db_host,
                    port=self.db_port,
                )
        
        return self._db
    
    def test_connection(self) -> bool:
        """Test database connection"""
        try:
            db = self.get_database()
            db.connect()
            db.close()
            return True
        except Exception as e:
            print(f"Database connection failed: {e}")
            return False
    
    def setup_pgvector(self):
        """Setup pgvector extension"""
        db = self.get_database()
        try:
            db.connect()
            # Create pgvector extension if it doesn't exist
            db.execute_sql("CREATE EXTENSION IF NOT EXISTS vector;")
            print("pgvector extension setup complete")
        except Exception as e:
            print(f"Warning: Could not setup pgvector extension: {e}")
        finally:
            if not db.is_closed():
                db.close()

# Global database configuration instance
db_config = DatabaseConfig() 