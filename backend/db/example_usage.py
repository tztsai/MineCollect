#!/usr/bin/env python3
"""
Example usage of the MineCollect database schema with Peewee ORM

This demonstrates basic CRUD operations and relationships.
"""

import uuid
from datetime import datetime
from db import Items, Labels, Channels, ImportJobs, init_db, connect_db, close_db

def example_usage():
    """Demonstrate basic database operations"""
    
    # Initialize database (run once)
    print("Initializing database...")
    init_db()
    
    # Connect to database
    connect_db()
    
    try:
        # Create a label
        print("\n1. Creating a label...")
        work_label = Labels.create(
            name="work",
            color="#ff6b35"
        )
        print(f"Created label: {work_label.name} ({work_label.id})")
        
        # Create an item
        print("\n2. Creating an item...")
        item = Items.create(
            source="web://example.com/article",
            path="/Readings/Articles/example-article",
            content="# Example Article\n\nThis is an example markdown article.",
            type="article",
            labels=[work_label.id],  # Array of label UUIDs
            metadata={
                "title": "Example Article",
                "author": "John Doe",
                "url": "https://example.com/article"
            }
        )
        print(f"Created item: {item.path} ({item.id})")
        
        # Create a channel
        print("\n3. Creating a channel...")
        channel = Channels.create(
            scheme="readwise",
            auth={"token": "sample_token"},
            config={"sync_highlights": True}
        )
        print(f"Created channel: {channel.scheme} ({channel.id})")
        
        # Create an import job
        print("\n4. Creating an import job...")
        job = ImportJobs.create(
            channel=channel,
            config={"last_sync": "2025-01-01"},
            status="pending"
        )
        print(f"Created import job: {job.id} (status: {job.status})")
        
        # Query examples
        print("\n5. Querying data...")
        
        # Find all items with work label
        work_items = Items.select().where(Items.labels.contains([work_label.id]))
        print(f"Found {work_items.count()} items with 'work' label")
        
        # Find all articles
        articles = Items.select().where(Items.type == "article")
        print(f"Found {articles.count()} articles")
        
        # Find pending import jobs
        pending_jobs = ImportJobs.select().where(ImportJobs.status == "pending")
        print(f"Found {pending_jobs.count()} pending import jobs")
        
        # Update an item
        print("\n6. Updating item...")
        item.content += "\n\nUpdated content!"
        item.save()  # This will automatically update the updated_at timestamp
        print(f"Updated item {item.id}")
        
        # Create a child item (hierarchical relationship)
        print("\n7. Creating child item...")
        child_item = Items.create(
            source="mine://notes/child",
            path="/Mine/Notes/child-note",
            content="This is a child note",
            type="note",
            parent=item  # Set parent relationship
        )
        print(f"Created child item: {child_item.id} (parent: {item.id})")
        
        # Query with joins
        print("\n8. Complex query with joins...")
        items_with_channels = (Items
                             .select(Items, ImportJobs, Channels)
                             .join(ImportJobs, on=(ImportJobs.channel.is_null(False)))
                             .join(Channels)
                             .where(Channels.scheme == "readwise"))
        
        for item_result in items_with_channels:
            print(f"Item {item_result.id} imported via {item_result.importjobs.channel.scheme}")
        
        print("\n✅ Example completed successfully!")
        
    except Exception as e:
        print(f"❌ Error during example: {e}")
        raise
    
    finally:
        # Close database connection
        close_db()

if __name__ == "__main__":
    example_usage() 