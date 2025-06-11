"""
Extractive Question Answering pipeline using Haystack
"""

import logging
from typing import List, Dict, Any, Optional

from haystack import Pipeline
from haystack.components.retrievers.in_memory import InMemoryEmbeddingRetriever
from haystack.components.readers import ExtractiveReader
from haystack.components.embedders import SentenceTransformersTextEmbedder
from haystack.document_stores.in_memory import InMemoryDocumentStore

logger = logging.getLogger(__name__)


class QAPipeline:
    """Extractive Question Answering pipeline"""
    
    def __init__(self, document_store: InMemoryDocumentStore, 
                 model_name: str = "sentence-transformers/multi-qa-mpnet-base-dot-v1",
                 top_k: int = 10):
        """
        Initialize the QA pipeline
        
        Args:
            document_store: The document store with indexed documents
            model_name: The sentence transformer model for embeddings
            top_k: Number of top documents to retrieve
        """
        self.document_store = document_store
        self.model_name = model_name
        self.top_k = top_k
        self.qa_pipeline = self._create_qa_pipeline()
        
        # Warm up the reader
        logger.info("Warming up the extractive reader...")
        self.qa_pipeline.get_component("reader").warm_up()
        logger.info("QA pipeline ready")
    
    def _create_qa_pipeline(self) -> Pipeline:
        """Create the extractive QA pipeline"""
        pipeline = Pipeline()
        
        # Add components
        pipeline.add_component("embedder", SentenceTransformersTextEmbedder(model=self.model_name))
        pipeline.add_component("retriever", InMemoryEmbeddingRetriever(
            document_store=self.document_store,
            top_k=self.top_k
        ))
        pipeline.add_component("reader", ExtractiveReader(
            model="deepset/roberta-base-squad2",
            top_k=3  # Top 3 answers per document
        ))
        
        # Connect components
        pipeline.connect("embedder.embedding", "retriever.query_embedding")
        pipeline.connect("retriever.documents", "reader.documents")
        
        return pipeline
    
    def ask_question(self, question: str, top_k_answers: int = 3) -> Dict[str, Any]:
        """
        Ask a question and get extractive answers
        
        Args:
            question: The question to ask
            top_k_answers: Number of top answers to return
            
        Returns:
            Dictionary containing answers and metadata
        """
        if not question.strip():
            raise ValueError("Question cannot be empty")
        
        logger.info(f"Processing question: {question}")
        
        try:
            # Run the QA pipeline
            result = self.qa_pipeline.run({
                "embedder": {"text": question},
                "reader": {"query": question, "top_k": top_k_answers}
            })
            
            # Extract answers
            answers = result.get("reader", {}).get("answers", [])
            retrieved_docs = result.get("retriever", {}).get("documents", [])
            
            # Format the response
            response = {
                "question": question,
                "answers": self._format_answers(answers),
                "retrieved_documents": len(retrieved_docs),
                "sources": self._extract_sources(retrieved_docs)
            }
            
            logger.info(f"Found {len(answers)} answers from {len(retrieved_docs)} documents")
            return response
            
        except Exception as e:
            logger.error(f"Error processing question: {e}")
            raise
    
    def _format_answers(self, answers: List[Any]) -> List[Dict[str, Any]]:
        """
        Format answers for response
        
        Args:
            answers: Raw answers from the reader
            
        Returns:
            Formatted answers list
        """
        formatted_answers = []
        
        for answer in answers:
            formatted_answer = {
                "text": answer.data,
                "confidence": round(answer.score, 4),
                "start_index": getattr(answer, 'start', None),
                "end_index": getattr(answer, 'end', None),
                "document_id": getattr(answer, 'document_id', None)
            }
            formatted_answers.append(formatted_answer)
        
        # Sort by confidence
        formatted_answers.sort(key=lambda x: x["confidence"], reverse=True)
        return formatted_answers
    
    def _extract_sources(self, documents: List[Any]) -> List[Dict[str, Any]]:
        """
        Extract source information from retrieved documents
        
        Args:
            documents: Retrieved documents
            
        Returns:
            List of source information
        """
        sources = []
        
        for doc in documents:
            source = {
                "document_id": doc.id,
                "content_preview": doc.content[:200] + "..." if len(doc.content) > 200 else doc.content,
                "score": round(doc.score, 4) if hasattr(doc, 'score') else None,
                "metadata": doc.meta
            }
            sources.append(source)
        
        return sources
    
    def get_similar_documents(self, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        """
        Get similar documents without extractive reading
        
        Args:
            query: Search query
            top_k: Number of documents to return
            
        Returns:
            List of similar documents
        """
        try:
            # Create a simple retrieval pipeline
            retrieval_pipeline = Pipeline()
            retrieval_pipeline.add_component("embedder", SentenceTransformersTextEmbedder(model=self.model_name))
            retrieval_pipeline.add_component("retriever", InMemoryEmbeddingRetriever(
                document_store=self.document_store,
                top_k=top_k
            ))
            retrieval_pipeline.connect("embedder.embedding", "retriever.query_embedding")
            
            result = retrieval_pipeline.run({
                "embedder": {"text": query}
            })
            
            documents = result.get("retriever", {}).get("documents", [])
            return self._extract_sources(documents)
            
        except Exception as e:
            logger.error(f"Error retrieving similar documents: {e}")
            raise 