#!/usr/bin/env python3
"""
Simple RAG-enhanced attribute extraction script.
Takes input query and outputs extracted attributes.
"""

import json
import asyncio
import aiohttp
import re
import torch
from datetime import datetime

from langchain_community.llms import Ollama
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_core.documents import Document
from langchain.chains import RetrievalQA
from langchain.chains.query_constructor.base import AttributeInfo
from langchain.retrievers.self_query.base import SelfQueryRetriever

# ======================================================================================
# --- Configuration ---
# ======================================================================================
CONFIG = {
    # --- Model and API Configuration ---
    "OLLAMA_BASE_URL": "http://localhost:11434",
    "MODEL_NAME": "hf.co/unsloth/Qwen3-8B-GGUF:Q4_K_XL",
    "EMBEDDING_MODEL": "Qwen/Qwen3-Embedding-0.6B",

    # --- File and Directory Paths ---
    "KNOWLEDGE_BASE_FILE": "scripts/rag_knowledge_base.json",
    "DB_PERSIST_DIR": "scripts/chroma_db_persistent",
    "DB_COLLECTION_NAME": "product_knowledge_base",
    
    # --- Performance and Behavior ---
    "RETRIEVER_TOP_K": 5,
}

# ======================================================================================
# --- RAG System ---
# ======================================================================================
class RAGSystem:
    """
    Manages the entire RAG pipeline, including the LLM, vector store, and retriever.
    Implements a persistent ChromaDB store for fast initialization.
    """
    def __init__(self, config):
        self.config = config
        self.llm = None
        self.vectorstore = None
        self.retriever = None
        self.qa_chain = None
        self.initialized = False

    async def initialize(self):
        """
        Initializes all components of the RAG system.
        If the vector store already exists on disk, it loads it. Otherwise, it builds
        it from the knowledge base and saves it for future runs.
        """
        try:
            print("Initializing RAG system...")

            # --- Step 1: Initialize Embeddings and LLM ---
            print(f"   - Initializing HuggingFace embedding model: {self.config['EMBEDDING_MODEL']}")
            embeddings = HuggingFaceEmbeddings(
                model_name=self.config['EMBEDDING_MODEL'],
                model_kwargs={"device": "cuda" if torch.cuda.is_available() else "cpu"},
                encode_kwargs={"normalize_embeddings": True}
            )
            
            print(f"   - Initializing LLM: {self.config['MODEL_NAME']}")
            self.llm = Ollama(
                model=self.config['MODEL_NAME'],
                base_url=self.config['OLLAMA_BASE_URL'],
                temperature=0.7, top_p=0.8, top_k=20
            )

            # --- Step 2: Load or Build the Vector Store ---
            persist_directory = self.config['DB_PERSIST_DIR']
            if os.path.exists(persist_directory):
                print(f"   - Loading existing vector store from: {persist_directory}")
                self.vectorstore = Chroma(
                    persist_directory=persist_directory,
                    embedding_function=embeddings,
                    collection_name=self.config['DB_COLLECTION_NAME']
                )
                print("   - Vector store loaded successfully.")
            else:
                print("   - No existing vector store found. Building a new one...")
                if not os.path.exists(self.config['KNOWLEDGE_BASE_FILE']):
                    print(f"Knowledge base not found at '{self.config['KNOWLEDGE_BASE_FILE']}'. Cannot build store.")
                    return

                with open(self.config['KNOWLEDGE_BASE_FILE'], "r", encoding="utf-8") as f:
                    kb = json.load(f)
                
                docs = [Document(page_content=entry["text"], metadata={"category": entry["category"]}) for entry in kb]
                
                print(f"   - Embedding {len(docs)} documents... (This is a one-time process)")
                self.vectorstore = Chroma.from_documents(
                    documents=docs,
                    embedding=embeddings,
                    persist_directory=persist_directory,
                    collection_name=self.config['DB_COLLECTION_NAME']
                )
                print(f"   - New vector store built and saved to: {persist_directory}")

            # --- Step 3: Set up the Self-Querying Retriever ---
            print("   - Setting up Self-Querying Retriever...")
            metadata_field_info = [
                AttributeInfo(
                    name="category",
                    description="The category of the product. Available options are: 'Desktop Computers', 'Monitors', 'Smartphones', 'Computer Components', 'Video Games and Consoles', 'Laptops', 'General'.",
                    type="string",
                ),
            ]
            self.retriever = SelfQueryRetriever.from_llm(
                llm=self.llm,
                vectorstore=self.vectorstore,
                document_contents="Rules and information about product attributes.",
                metadata_field_info=metadata_field_info,
                search_kwargs={"k": self.config['RETRIEVER_TOP_K']}
            )
            print("   - Retriever is ready.")

            # --- Step 4: Build the final QA Chain ---
            print("   - Building RetrievalQA chain...")
            self.qa_chain = RetrievalQA.from_chain_type(
                llm=self.llm,
                retriever=self.retriever,
                return_source_documents=True,
                chain_type="stuff",
            )
            self.initialized = True
            print("RAG system initialized successfully.")

        except Exception as e:
            print(f"RAG initialization failed: {e}. The script cannot continue without it.")
            self.initialized = False

    async def extract_with_rag(self, query: str) -> dict:
        """
        Performs attribute extraction for a given query using the RAG chain.
        """
        if not self.initialized:
            print("RAG system not initialized. Skipping extraction.")
            return {}

        if not self.qa_chain:
            print("QA chain not available. Skipping extraction.")
            return {}

        try:
            # Add /no_think instruction to the query
            formatted_query = f"/no_think {query}"
            
            # Run the chain directly
            result = await self.qa_chain.ainvoke({"query": formatted_query})
            
            def extract_json_from_string(s: str) -> str:
                if "</think>" in s:
                    s = s.split("</think>", 1)[1]
                match = re.search(r'\{.*\}', s, re.DOTALL)
                if match:
                    return match.group(0)
                raise ValueError("No JSON object found in the model's response string.")

            try:
                json_str = extract_json_from_string(result["result"])
                rag_attributes = json.loads(json_str)

                if isinstance(rag_attributes, dict):
                    rag_attributes["_rag_sources"] = [doc.page_content for doc in result["source_documents"]]
                    rag_attributes["_rag_enhanced"] = True
                    return rag_attributes
                else:
                    print(f"RAG output was not a JSON dictionary: {rag_attributes}")
                    return {}
            except (json.JSONDecodeError, ValueError) as e:
                print(f"Failed to parse JSON from RAG response: {e}")
        except Exception as e:
            print(f"RAG extraction process failed: {e}")
        
        return {}

# ======================================================================================
# --- Main Query Interface ---
# ======================================================================================

async def extract_attributes_from_query(query):
    """
    Extract attributes from input query using RAG enhancement.
    
    Args:
        query (str): The input query to extract attributes from
    
    Returns:
        dict: Extracted attributes
    """
    rag_system = RAGSystem(CONFIG)
    await rag_system.initialize()
    
    if not rag_system.initialized:
        return {"error": "Failed to initialize RAG system"}
    
    result = await rag_system.extract_with_rag(query)
    
    if not result:
        return {"error": "Failed to extract attributes"}
    
    return result

async def main():
    """Simple query interface for attribute extraction."""
    print("🚀 RAG-enhanced Attribute Extractor")
    print("=" * 50)
    
    if not await test_connection(CONFIG):
        print("❌ Cannot connect to Ollama. Please make sure it's running.")
        return
    
    print("✅ Connected to Ollama successfully!")
    print("\nEnter your query:")
    print("-" * 50)
    
    try:
        # Read input query
        query = input().strip()
        
        if not query:
            print("❌ No query provided.")
            return
        
        print(f"\n📝 Processing query: {query}")
        
        # Extract attributes
        result = await extract_attributes_from_query(query)
        
        # Display results
        print("\n" + "=" * 50)
        print("📊 EXTRACTION RESULTS")
        print("=" * 50)
        
        if "error" in result:
            print(f"❌ Error: {result['error']}")
        else:
            print(f"🔍 RAG Enhanced: {'Yes' if result.get('_rag_enhanced') else 'No'}")
            
            print("\n📋 Extracted Attributes:")
            for key, value in result.items():
                if not key.startswith('_'):
                    print(f"  {key}: {value}")
            
            if result.get('_rag_sources'):
                print(f"\n📚 Knowledge Base Sources ({len(result['_rag_sources'])}):")
                for i, source in enumerate(result['_rag_sources'][:3], 1):
                    print(f"  {i}. {source[:100]}{'...' if len(source) > 100 else ''}")
        
        print("=" * 50)
        
    except KeyboardInterrupt:
        print("\n\n👋 Goodbye!")
    except Exception as e:
        print(f"\n❌ An error occurred: {e}")

async def test_connection(config):
    """Tests the connection to the Ollama server and checks for model availability."""
    print("Testing connection to Ollama...")
    try:
        timeout = aiohttp.ClientTimeout(total=10)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(f"{config['OLLAMA_BASE_URL']}/api/tags") as response:
                response.raise_for_status()
                data = await response.json()
                models = [model.get("name", "") for model in data.get("models", [])]
                
                if config['MODEL_NAME'] not in models:
                    print(f"Error: Main LLM '{config['MODEL_NAME']}' not found in Ollama.")
                    print(f"   Available models: {', '.join(models)}")
                    return False
                
                print(f"Connected to Ollama. LLM '{config['MODEL_NAME']}' is available.")
                return True
    except Exception as e:
        print(f"Connection to Ollama failed: {e}")
        return False

if __name__ == "__main__":
    import os
    asyncio.run(main()) 