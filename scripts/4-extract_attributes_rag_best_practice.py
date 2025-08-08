#!/usr/bin/env python3
"""
This script extracts product attributes from listings using a RAG (Retrieval-Augmented Generation)
system. It has been optimized with best practices for efficiency and maintainability.

Key Features:
- **Persistent Vector Store**: Creates the ChromaDB vector store once and reuses it on
  subsequent runs for near-instant startup.
- **Structured Configuration**: All settings are grouped in a single dictionary for clarity.
- **Self-Querying Retriever**: Uses the LLM to intelligently filter the knowledge base
  by category before retrieving relevant documents.
- **Asynchronous Processing**: Processes listings in concurrent batches to speed up extraction.
"""

import json
import asyncio
import aiohttp
import time
import copy
import os
import re
from datetime import datetime

from langchain_community.llms import Ollama
from langchain_chroma import Chroma
from langchain_community.embeddings import OllamaEmbeddings
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
    "EMBEDDING_MODEL": "dengcao/Qwen3-Embedding-0.6B:Q8_0",

    # --- File and Directory Paths ---
    "INPUT_FILE": "scripts/3-scraped_listing_data-gwen.json",
    "KNOWLEDGE_BASE_FILE": "scripts/rag_knowledge_base.json",
    "DB_PERSIST_DIR": "scripts/chroma_db_persistent",
    "DB_COLLECTION_NAME": "product_knowledge_base",
    "IDS_TO_SKIP_FILE": "scripts/listings_from_db.txt",
    
    # --- Output Configuration ---
    "OUTPUT_FILE": "scripts/4-extracted_listing_details-best_practice.json",
    "FAILED_LOG_FILE": "scripts/failed_model_extractions.log",

    # --- Performance and Behavior ---
    "MAX_CONCURRENT_REQUESTS": 1,  # Increased from 1 for better concurrency
    "REQUEST_TIMEOUT": 120,
    "BATCH_SIZE": 6,
    "RETRIEVER_TOP_K": 5, # How many documents the retriever should fetch.
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
            print(f"   - Initializing Ollama embedding model client: {self.config['EMBEDDING_MODEL']}")
            embeddings = OllamaEmbeddings(
                model=self.config['EMBEDDING_MODEL'],
                base_url=self.config['OLLAMA_BASE_URL']
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
                
                print(f"   - Embedding {len(docs)} documents... (This is a one-time process and may take a while)")
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
                document_contents="Product attribute rules and specifications including brands, models, specifications, technical details, and product information for various categories like computers, phones, monitors, and components.",
                metadata_field_info=metadata_field_info,
                search_kwargs={
                    "k": self.config['RETRIEVER_TOP_K'],  # Fetch more candidates for filtering
                }
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

    async def extract_with_rag(self, prompt: str, category: str) -> dict:
        """
        Performs attribute extraction for a given prompt and category using the RAG chain.
        """
        if not self.initialized:
            print("RAG system not initialized. Skipping extraction.")
            return {}

        if not self.qa_chain:
            print("QA chain not available. Skipping extraction.")
            return {}

        try:
            # The Self-Query retriever uses the LLM to infer the filter from the query.
            # We include the category explicitly to guide it.
            query = f"Extract product attributes from this listing in category '{category}': {prompt}"

            # Run the chain directly
            result = await self.qa_chain.ainvoke({"query": query})
            
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

                # Debug: Print retrieved sources
                print(f"   - Retrieved {len(result['source_documents'])} documents")
                for i, doc in enumerate(result['source_documents'][:2]):
                    print(f"     Source {i+1}: {doc.page_content[:100]}...")

                # Only log if the extraction completely failed (no valid attributes at all)
                if not rag_attributes or (isinstance(rag_attributes, dict) and len(rag_attributes) <= 1):
                    with open(self.config['FAILED_LOG_FILE'], "a", encoding="utf-8") as f:
                        log_entry = {
                            "timestamp": datetime.now().isoformat(),
                            "prompt": prompt,
                            "response": result["result"],
                            "sources": [doc.page_content for doc in result["source_documents"]]
                        }
                        f.write(json.dumps(log_entry, ensure_ascii=False) + "\n")
                
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
# --- Helper Functions ---
# ======================================================================================

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

def create_prompt(title, description, category, existing_brand="Unknown"):
    """Creates a standardized, category-specific prompt for the LLM."""
    base_instruction = f"""Extract product attributes from this listing. Follow these rules:
1. Extract ONLY explicitly mentioned attributes. For attributes not in the raw listing, you may fall back to any retrieved KB facts (use the casing in the facts). But do not invent beyond that.
2. Use "null" for missing or unclear values.
3. If the listing clearly mentions multiple brands or models, pick only one of them.
4. Dont contain other attributes in the Model field.
4. Your output MUST be ONLY a valid JSON object, with no additional text or explanations.


Listing Title: {title}
Listing Description: {description[:1000]}...
Known Brand: {existing_brand if existing_brand is not None else "To be determined"}
"""
    # (Prompts dictionary remains the same as the original script)
    prompts = {
        "Desktop Computers": '''
Return JSON format:
{{
"Brand": "brand or null",
"Model": "model only or null", 
"Color": "color (in english lowercase) or null",
"Processor_branding": "Core Ultra 7, Core i5, Core i7, Core i9, etc. or null",
"Processor_model": "14900F, 14700F, 14600K, (M1, M2, M3, M4) etc. or null",
"Graphics card": "graphics card or null", 
"RAM": "integer(RAM in GB) or null",
"Operating system": "OS or null",
"Storage": "integer(storage in GB) or null",
"confidence_score": "integer(0-100)"
}}''',
        "Monitors": '''
Return JSON format:
{{
"Brand": "brand or null",
"Model": "model only or null", 
"Size": "integer(screen size in inches) or null",
"Resolution": "resolution string (e.g., '1920x1080') or null",
"Refresh rate": "integer(refresh rate in Hz) or null",
"Latency": "integer(latency in ms) or null",
"Panel technology": "TN/VA/IPS/OLED or null",
"confidence_score": "integer(0-100)"
}}''',
        "Smartphones": '''
Return JSON format:
{{
"Brand": "brand or null",
"Model": "model only or null",
"Color": "color (in english lowercase) or null",
"RAM": "integer(RAM in GB) or null",
"Storage": "integer(storage in GB) or null",
"Battery_health": "integer(battery health in % if mentioned) or null",
"is_phone": "boolean(true if it is a phone, false if it\'s parts, accessories, or services)",
"confidence_score": "integer(0-100)"
}}''',
        "Computer Components": '''
Return JSON format:
{{
"Brand": "brand or null",
"Model": "model only or null",
"Type": "Graphics card, CPU, RAM, SSD, HDD, Motherboard, Power supply, Cooling, Case, etc. or null",
"RAM_type": "DDR3, DDR4, DDR5, etc. or null",
"RAM_amount": "integer(RAM or VRAM in GB) or null",
"Processor_branding": "Core Ultra 7, Core i5, Core i7, Core i9, etc. or null",
"Processor_model": "14900F, 14700F, 14600K, (M1, M2, M3, M4) etc. or null",
"Storage_type": "SSD, HDD, NVMe, etc. or null",
"Storage_size": "integer(storage in GB) or null",
"Storage_speed": "integer(storage speed in GB/s) or null",
"Form_factor": "ATX, Micro-ATX, Mini-ITX, etc. or null",
"Socket": "socket or null",
"Power_consumption": "integer(power consumption in watts) or null",
"Cooling_type": "air, liquid, etc. or null",
"confidence_score": "integer(0-100)"
}}''',
        "Laptops": '''
Return JSON format:
{{
"Brand": "brand or null",
"Model": "model or null (Include only the base model, not the screen size)",
"Storage": "integer(storage in GB) or null",
"Color": "color (in english lowercase) or null",
"Processor_branding": "Core Ultra 7, Core i5, Core i7, Core i9, etc. or null",
"Processor_model": "14900F, 14700F, 14600K, (M1, M2, M3, M4) etc. or null",
"Screen size": "integer(screen size in inches, rounded) or null",
"Graphics card": "graphics card or null",
"RAM": "integer(RAM in GB) or null",
"Operating system": "OS or null",
"Year": "integer(year) or null",
"confidence_score": "integer(0-100)"
}}

Available processors (ignore if not a MacBook):
Intel Processors: Core 2 Duo, Core i3/i5/i7/i9, Xeon
Apple Silicon: M1, M1 Pro/M1 Max, M2, M2 Pro/M2 Max, M3, M3 Pro/M3 Max, M4, M4 Pro/M4 Max
''',
        "General": '''
Return JSON format:
{{
"Brand": "brand or null",
"Model": "model only or null",
"Storage": "integer(storage in GB) or null",
"Color": "color (in english lowercase) or null",
"Year": "integer(year) or null",
"confidence_score": "integer(0-100)"
}}'''
    }
    return f"{base_instruction}\n{prompts.get(category, prompts['General'])}"

def get_category(listing):
    """Determines the most specific category for a listing."""
    categories = listing.get("categories_en", [])
    if not categories:
        return "General"
    last_category = categories[-1]
    if "Desktop Computers" in last_category: return "Desktop Computers"
    if "Smartphones" in last_category: return "Smartphones"
    if "Monitors" in last_category: return "Monitors"
    if "Computer Components" in last_category: return "Computer Components"
    if "Laptops" in last_category: return "Laptops"
    if "Video Games and Consoles" in categories: return "Video Games and Consoles"
    return "General"

def clean_and_finalize_attributes(attributes, existing_brand):
    """Cleans, validates, and type-converts extracted attributes."""
    cleaned = {}
    
    # --- Boolean field conversion ---
    boolean_fields = ["is_phone"]
    for field in boolean_fields:
        if field in attributes:
            value = attributes[field]
            if isinstance(value, str):
                val_lower = value.lower().strip()
                if val_lower in ["true", "1", "yes"]:
                    attributes[field] = True
                elif val_lower in ["false", "0", "no"]:
                    attributes[field] = False
                else:
                    del attributes[field]
            elif not isinstance(value, bool):
                del attributes[field]

    # --- Field processing and type conversion ---
    all_fields = [
        "Brand", "Model", "Storage", "Color", "Processor", "Graphics card", 
        "RAM", "Operating system", "Year", "Size", "Resolution", 
        "Refresh rate", "Latency", "Panel technology", "Type", "RAM_type",
        "RAM_amount", "Storage_type", "Storage_size", "Storage_speed",
        "Form_factor", "Socket", "Power_consumption", "Cooling_type", 
        "Battery_health", "is_phone", "Screen size", "Processor_branding", "Processor_model"
    ]
    numeric_fields = [
        "Year", "RAM", "RAM_amount", "Storage", "Storage_size", "Storage_speed", 
        "Power_consumption", "Refresh rate", "Latency", "Battery_health", "Size", "Screen size"
    ]

    for field in all_fields:
        value = attributes.get(field)
        if value is not None and str(value).lower().strip() not in ["null", "unknown", "unclear", "", "n/a"]:
            if field in numeric_fields:
                try:
                    num_str = re.sub(r'[^\d.]', '', str(value))
                    if num_str:
                        cleaned[field] = int(float(num_str))
                except (ValueError, TypeError):
                    pass
            else:
                 cleaned[field] = str(value).strip()
                 
    if existing_brand and "Brand" not in cleaned:
        cleaned["Brand"] = existing_brand

    try:
        confidence = int(attributes.get("confidence_score", 0)) / 100.0
        cleaned["_extraction_confidence"] = round(confidence, 2)
    except (ValueError, TypeError):
        cleaned["_extraction_confidence"] = 0.0

    cleaned["_extraction_timestamp"] = datetime.now().isoformat()
    if attributes.get("_rag_enhanced"):
        cleaned["_rag_enhanced"] = True
        cleaned["_rag_sources"] = attributes.get("_rag_sources", [])

    return cleaned

# ======================================================================================
# --- Main Execution Logic ---
# ======================================================================================

async def process_listing(semaphore, listing, rag_system):
    """Wrapper to process a single listing with concurrency control."""
    async with semaphore:
        title = listing.get("title_en", "")
        description = listing.get("description_en", "")
        
        if not title and not description:
            return listing # Skip listings with no data

        category = get_category(listing)
        existing_brand = listing.get("details", {}).get("Brand") or listing.get("details", {}).get("Manufacturer")

        prompt = create_prompt(title, description, category, existing_brand)
        
        raw_attributes = await rag_system.extract_with_rag(prompt, category)
        
        if not raw_attributes:
            return listing

        final_attributes = clean_and_finalize_attributes(raw_attributes, existing_brand)
        
        enhanced_listing = copy.deepcopy(listing)
        if "details" not in enhanced_listing:
            enhanced_listing["details"] = {}
        enhanced_listing["details"].update(final_attributes)
        
        return enhanced_listing

async def main(config):
    """Main function to orchestrate the extraction process."""
    print("Starting RAG-based attribute extraction (Best Practices Edition)...")
    
    if not await test_connection(config):
        return
        
    try:
        with open(config['INPUT_FILE'], 'r', encoding='utf-8') as f:
            listings = json.load(f)
    except FileNotFoundError:
        print(f"Error: Input file not found at '{config['INPUT_FILE']}'")
        return
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in input file: {e}")
        return
    
    # --- Filter out already processed listings ---
    ids_to_skip = set()
    if os.path.exists(config['IDS_TO_SKIP_FILE']):
        with open(config['IDS_TO_SKIP_FILE'], 'r', encoding='utf-8') as f:
            ids_to_skip = {line.strip() for line in f if line.strip()}
    print(f"Found {len(ids_to_skip)} listing IDs to skip.")
    
    successful = [
        l for l in listings 
        if l.get("status") == "success" and str(l.get("listing_id")) not in ids_to_skip
    ]
    if not successful:
        print("No new listings to process.")
        return
        
    print(f"Processing {len(successful)} new listings...")
    
    # --- Process in Batches ---
    semaphore = asyncio.Semaphore(config['MAX_CONCURRENT_REQUESTS'])
    batches = [successful[i:i + config['BATCH_SIZE']] for i in range(0, len(successful), config['BATCH_SIZE'])]
    
    start_time = time.time()
    all_results = []
    if os.path.exists(config['OUTPUT_FILE']):
        try:
            with open(config['OUTPUT_FILE'], 'r', encoding='utf-8') as f:
                all_results = json.load(f)
            print(f"Loaded {len(all_results)} existing results from '{config['OUTPUT_FILE']}'.")
        except Exception as e:
            print(f"Could not load existing results: {e}. Starting fresh.")
            all_results = []

    try:
        rag_system = RAGSystem(config)
        await rag_system.initialize()
        if not rag_system.initialized:
            print("Script aborted due to RAG initialization failure.")
            return

        for i, batch in enumerate(batches, 1):
            print(f"Processing batch {i}/{len(batches)} ({len(batch)} listings)...")
            tasks = [process_listing(semaphore, listing, rag_system) for listing in batch]
            batch_results = await asyncio.gather(*tasks, return_exceptions=True)
            await asyncio.sleep(1)  # Add a 1-second delay between batches
            
            # Filter out exceptions and append good results
            for res in batch_results:
                if isinstance(res, Exception):
                    print(f"   - Error processing a listing: {res}")
                else:
                    all_results.append(res)
            
            # Save progress
            with open(config['OUTPUT_FILE'], 'w', encoding='utf-8') as f:
                json.dump(all_results, f, ensure_ascii=False, indent=2)
            print(f"   - Progress saved ({len(all_results)} total listings).")
    
    except Exception as e:
        print(f"An unexpected error occurred during processing: {e}")
    
    finally:
        # Clean up resources
        if 'rag_system' in locals() and rag_system.initialized:
            try:
                # Close any open connections
                if hasattr(rag_system.vectorstore, '_client'):
                    rag_system.vectorstore._client.close()
            except Exception as cleanup_error:
                print(f"Warning: Error during cleanup: {cleanup_error}")
        
        # --- Final Statistics ---
        total_time = time.time() - start_time
        newly_processed_count = sum(len(b) for b in batches)
        
        print("\n" + "="*50)
        print("Extraction complete!")
        print(f"Total time: {total_time:.2f}s")
        print(f"Processed {newly_processed_count} new listings.")
        print(f"All {len(all_results)} results saved to: {config['OUTPUT_FILE']}")
        print("="*50)

if __name__ == "__main__":
    asyncio.run(main(CONFIG))