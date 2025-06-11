"""
Document processing and indexing using Unstructured and Haystack
"""

import os
import logging
from pathlib import Path
from typing import List, Optional

from haystack import Pipeline, Document
from haystack.components.writers import DocumentWriter
from haystack.components.embedders import SentenceTransformersDocumentEmbedder
from haystack.document_stores.in_memory import InMemoryDocumentStore
from haystack_integrations.components.converters.unstructured import UnstructuredFileConverter

logger = logging.getLogger(__name__)


class DocumentProcessor:
    """Handles document processing, conversion, and indexing"""
    
    def __init__(self, model_name: str = "sentence-transformers/multi-qa-mpnet-base-dot-v1"):
        """
        Initialize the document processor
        
        Args:
            model_name: The sentence transformer model for embeddings
        """
        self.model_name = model_name
        self.document_store = InMemoryDocumentStore()
        self.indexing_pipeline = self._create_indexing_pipeline()
    
    def _create_indexing_pipeline(self) -> Pipeline:
        """Create the document indexing pipeline"""
        pipeline = Pipeline()
        
        # Add components
        pipeline.add_component("converter", UnstructuredFileConverter())
        pipeline.add_component("embedder", SentenceTransformersDocumentEmbedder(model=self.model_name))
        pipeline.add_component("writer", DocumentWriter(self.document_store))
        
        # Connect components
        pipeline.connect("converter.documents", "embedder.documents")
        pipeline.connect("embedder.documents", "writer.documents")
        
        return pipeline
    
    def process_documents(self, data_path: str = "data/") -> int:
        """
        Process all documents in the specified directory
        
        Args:
            data_path: Path to the directory containing documents
            
        Returns:
            Number of documents processed
        """
        data_dir = Path(data_path)
        
        if not data_dir.exists():
            logger.warning(f"Data directory {data_path} does not exist")
            return 0
        
        # Find all supported document files
        file_paths = self._find_document_files(data_dir)
        
        if not file_paths:
            logger.warning(f"No supported documents found in {data_path}")
            return 0
        
        logger.info(f"Processing {len(file_paths)} documents from {data_path}")
        
        try:
            # Run the indexing pipeline
            result = self.indexing_pipeline.run({
                "converter": {"paths": file_paths}
            })
            
            documents_written = len(result.get("writer", {}).get("documents_written", []))
            logger.info(f"Successfully indexed {documents_written} documents")
            
            return documents_written
            
        except Exception as e:
            logger.error(f"Error processing documents: {e}")
            raise
    
    def _find_document_files(self, data_dir: Path) -> List[str]:
        """
        Find all supported document files in the directory
        
        Args:
            data_dir: Directory to search
            
        Returns:
            List of file paths
        """
        supported_extensions = {
            '.pdf', '.docx', '.doc', '.txt', '.md', '.html', '.htm',
            '.rtf', '.odt', '.pptx', '.ppt', '.xlsx', '.xls'
        }
        
        file_paths = []
        for file_path in data_dir.rglob("*"):
            if file_path.is_file() and file_path.suffix.lower() in supported_extensions:
                file_paths.append(str(file_path))
        
        return file_paths
    
    def add_document(self, document: Document) -> None:
        """
        Add a single document to the store
        
        Args:
            document: Document to add
        """
        # Generate embedding for the document
        embedding_result = self.indexing_pipeline.get_component("embedder").run(
            documents=[document]
        )
        
        # Write to document store
        self.document_store.write_documents(embedding_result["documents"])
    
    def get_document_count(self) -> int:
        """Get the number of indexed documents"""
        return self.document_store.count_documents()
    
    def clear_documents(self) -> None:
        """Clear all documents from the store"""
        self.document_store.delete_documents()
        logger.info("Cleared all documents from the store") 