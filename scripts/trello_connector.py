#!/usr/bin/env python3
"""
Kanban to Trello Importer

This script imports a kanban board JSON file into Trello, creating:
- Lists from the kanban board
- Cards with descriptions, due dates, and labels
- Checklists from card checkboxes
- Comments on cards
- Labels from the settings

Requirements:
    pip install py-trello

Usage:
    1. Get your Trello API credentials from https://trello.com/app-key
    2. Update the configuration section below with your credentials
    3. Run: python kanban_to_trello.py
"""

import os
import json
from dotenv import load_dotenv
from pathlib import Path
from datetime import datetime
from trello import TrelloClient

load_dotenv()

TRELLO_API_KEY = os.getenv('TRELLO_API_KEY')
TRELLO_API_TOKEN = os.getenv('TRELLO_API_TOKEN')
TRELLO_BOARD_ID = os.getenv('TRELLO_BOARD_ID')
KANBAN_FILE_PATH = Path(__file__).parent.parent / '.pm' / '0-planning' / 'main.kanban'

def load_kanban_data(file_path):
    """Load and parse the kanban JSON file."""
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Kanban file not found: {file_path}")
    
    with open(file_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def connect_to_trello(api_key, api_token, board_id):
    """Connect to Trello and return the board object."""
    print("Connecting to Trello...")
    client = TrelloClient(api_key=api_key, token=api_token)
    
    try:
        board = client.get_board(board_id)
        print(f"✅ Connected to board: '{board.name}'")
        return board
    except Exception as e:
        raise Exception(f"❌ Could not connect to board '{board_id}': {e}")

def create_labels(board, kanban_labels):
    """Create labels in Trello and return a mapping of kanban label IDs to Trello labels."""
    print("\n📍 Creating labels...")
    
    # Get existing labels on the board
    existing_labels = board.get_labels()
    existing_label_names = {label.name: label for label in existing_labels}
    
    label_mapping = {}
    
    for kanban_label in kanban_labels:
        label_name = kanban_label['title']
        label_color = kanban_label['color']
        
        # Convert hex color to Trello color name (Trello uses predefined color names)
        trello_color = hex_to_trello_color(label_color)
        
        if label_name in existing_label_names:
            print(f"  📍 Label '{label_name}' already exists, reusing...")
            label_mapping[kanban_label['id']] = existing_label_names[label_name]
        else:
            try:
                trello_label = board.add_label(name=label_name, color=trello_color)
                label_mapping[kanban_label['id']] = trello_label
                print(f"  ✅ Created label: '{label_name}' ({trello_color})")
            except Exception as e:
                print(f"  ❌ Failed to create label '{label_name}': {e}")
    
    return label_mapping

def hex_to_trello_color(hex_color):
    """Convert hex color to Trello color name."""
    color_mapping = {
        '#61bd4f': 'green',
        '#f2d600': 'yellow', 
        '#ff9f1a': 'orange',
        '#eb5a46': 'red',
        '#c377e0': 'purple',
        '#0079bf': 'blue',
        '#00c2e0': 'sky',
        '#51e898': 'lime',
        '#ff78cb': 'pink',
        '#344563': 'black'
    }
    return color_mapping.get(hex_color, 'blue')  # Default to blue

def create_lists_and_cards(board, kanban_data, label_mapping):
    """Create lists and cards from kanban data."""
    print("\n📋 Creating lists and cards...")
    
    # Get existing lists to avoid duplicates
    existing_lists = board.list_lists()
    existing_list_names = {lst.name: lst for lst in existing_lists}
    
    for kanban_list in kanban_data['lists']:
        list_name = kanban_list['title']
        
        # Create or get the list
        if list_name in existing_list_names:
            print(f"  📋 List '{list_name}' already exists, using existing...")
            trello_list = existing_list_names[list_name]
        else:
            trello_list = board.add_list(name=list_name)
            print(f"  ✅ Created list: '{list_name}'")
        
        # Create cards in this list
        for kanban_card in kanban_list['cards']:
            create_card(trello_list, kanban_card, label_mapping)

def create_card(trello_list, kanban_card, label_mapping):
    """Create a single card with all its components."""
    card_title = kanban_card['title']
    card_desc = kanban_card.get('description', '')
    
    # Parse due date if present
    due_date = None
    if kanban_card.get('dueDate'):
        try:
            due_date = datetime.fromisoformat(kanban_card['dueDate'].replace('Z', '+00:00'))
        except:
            due_date = None
    
    try:
        # Create the card
        trello_card = trello_list.add_card(name=card_title, desc=card_desc)
        print(f"    ✅ Created card: '{card_title}'")
        
        # Set due date
        if due_date:
            trello_card.set_due(due_date)
        
        # Add labels
        for kanban_label in kanban_card.get('labels', []):
            if kanban_label['id'] in label_mapping:
                trello_label = label_mapping[kanban_label['id']]
                trello_card.add_label(trello_label)
                print(f"      🏷️  Added label: '{trello_label.name}'")
        
        # Add checklist items
        if kanban_card.get('checkboxes'):
            checklist_name = "Tasks"
            checklist_items = [cb['title'] for cb in kanban_card['checkboxes']]
            
            if checklist_items:
                try:
                    # Create checklist with all items
                    checklist = trello_card.add_checklist(checklist_name, checklist_items)
                    
                    # Set checked state for each item
                    for i, kanban_checkbox in enumerate(kanban_card['checkboxes']):
                        if kanban_checkbox.get('checked', False):
                            # Get the checklist item and mark it as complete
                            checklist_items = checklist.items
                            if i < len(checklist_items):
                                checklist_items[i].set_state(True)
                    
                    print(f"      ☑️  Added checklist with {len(checklist_items)} items")
                except Exception as e:
                    print(f"      ❌ Failed to add checklist: {e}")
        
        # Add comments
        for kanban_comment in kanban_card.get('comments', []):
            comment_text = kanban_comment.get('comment', '')
            if comment_text:
                try:
                    trello_card.comment(comment_text)
                    print(f"      💬 Added comment")
                except Exception as e:
                    print(f"      ❌ Failed to add comment: {e}")
                    
    except Exception as e:
        print(f"    ❌ Failed to create card '{card_title}': {e}")

def main():
    """Main function to run the import process."""
    print("🚀 Starting Kanban to Trello Import")
    print("=" * 50)
    
    # Validate configuration
    if TRELLO_API_KEY == "YOUR_API_KEY" or TRELLO_API_TOKEN == "YOUR_API_TOKEN" or TRELLO_BOARD_ID == "YOUR_BOARD_ID":
        print("❌ Error: Please update the script with your Trello API credentials.")
        print("   Get them from: https://trello.com/app-key")
        return
    
    try:
        # Load kanban data
        print(f"📂 Loading kanban data from: {KANBAN_FILE_PATH}")
        kanban_data = load_kanban_data(KANBAN_FILE_PATH)
        print(f"✅ Loaded {len(kanban_data['lists'])} lists")
        
        # Connect to Trello
        board = connect_to_trello(TRELLO_API_KEY, TRELLO_API_TOKEN, TRELLO_BOARD_ID)
        
        # Create labels first
        kanban_labels = kanban_data.get('settings', {}).get('labels', [])
        label_mapping = create_labels(board, kanban_labels)
        
        # Create lists and cards
        create_lists_and_cards(board, kanban_data, label_mapping)
        
        print("\n" + "=" * 50)
        print("🎉 Import completed successfully!")
        print(f"📊 Summary:")
        
        total_cards = sum(len(lst['cards']) for lst in kanban_data['lists'])
        print(f"   • Lists: {len(kanban_data['lists'])}")
        print(f"   • Cards: {total_cards}")
        print(f"   • Labels: {len(kanban_labels)}")
        
        print(f"\n🔗 View your board: https://trello.com/b/{TRELLO_BOARD_ID}")
        
    except Exception as e:
        print(f"\n❌ Import failed: {e}")
        return 1
    
    return 0

if __name__ == "__main__":
    exit(main()) 