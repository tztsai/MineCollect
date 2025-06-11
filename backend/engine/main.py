"""
Main script to demonstrate the Document Processing and QA pipeline
"""

import logging
import sys
from pathlib import Path

from document_processor import DocumentProcessor
from qa_pipeline import QAPipeline

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def main():
    """Main function to demonstrate the QA system"""
    
    print("🚀 MineCollect QA Engine")
    print("=" * 50)
    
    # Initialize document processor
    print("📚 Initializing document processor...")
    processor = DocumentProcessor()
    
    # Process documents from data/ directory
    print("📖 Processing documents...")
    try:
        num_docs = processor.process_documents("data/")
        if num_docs == 0:
            print("⚠️  No documents found in data/ directory")
            print("💡 Please add some documents (.pdf, .txt, .md, etc.) to the data/ folder")
            return
        
        print(f"✅ Successfully processed {num_docs} documents")
        
    except Exception as e:
        print(f"❌ Error processing documents: {e}")
        return
    
    # Initialize QA pipeline
    print("🧠 Initializing QA pipeline...")
    try:
        qa_pipeline = QAPipeline(processor.document_store)
        print("✅ QA pipeline ready")
        
    except Exception as e:
        print(f"❌ Error initializing QA pipeline: {e}")
        return
    
    # Interactive Q&A loop
    print("\n" + "=" * 50)
    print("💬 Interactive Q&A Session")
    print("Type 'quit' to exit, 'search' for document search")
    print("=" * 50)
    
    while True:
        try:
            question = input("\n🤔 Your question: ").strip()
            
            if question.lower() in ['quit', 'exit', 'q']:
                print("👋 Goodbye!")
                break
            
            if question.lower().startswith('search'):
                # Document search mode
                query = input("🔍 Search query: ").strip()
                if query:
                    docs = qa_pipeline.get_similar_documents(query)
                    print(f"\n📄 Found {len(docs)} similar documents:")
                    for i, doc in enumerate(docs, 1):
                        print(f"\n{i}. Score: {doc['score']}")
                        print(f"   Preview: {doc['content_preview']}")
                continue
            
            if not question:
                print("⚠️  Please enter a question")
                continue
            
            # Ask the question
            result = qa_pipeline.ask_question(question)
            
            print(f"\n📊 Results for: '{result['question']}'")
            print(f"🔎 Retrieved {result['retrieved_documents']} documents")
            
            answers = result['answers']
            if answers:
                print(f"\n💡 Top {len(answers)} answers:")
                for i, answer in enumerate(answers, 1):
                    print(f"\n{i}. {answer['text']}")
                    print(f"   Confidence: {answer['confidence']:.2%}")
            else:
                print("😔 No answers found. Try rephrasing your question.")
            
            # Show sources
            if result['sources']:
                print(f"\n📚 Sources:")
                for i, source in enumerate(result['sources'][:3], 1):
                    print(f"{i}. Score: {source['score']}")
                    print(f"   Preview: {source['content_preview'][:100]}...")
        
        except KeyboardInterrupt:
            print("\n👋 Goodbye!")
            break
        except Exception as e:
            print(f"❌ Error: {e}")


if __name__ == "__main__":
    # Create data directory if it doesn't exist
    data_dir = Path(__file__).parent.parent.parent / "data"
    if not data_dir.exists():
        data_dir.mkdir()
        print(f"📁 Created data/ directory")
        print("📄 Please add some documents to data/ and run again")
        sys.exit(1)
    
    main() 