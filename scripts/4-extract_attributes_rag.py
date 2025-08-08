#!/usr/bin/env python3
"""Enhanced async attribute extraction script using a RAG-only approach."""

import json
import asyncio
import aiohttp
import time
import copy
import os
import re
from datetime import datetime
from langchain_community.llms import Ollama
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_core.documents import Document
from langchain.chains import RetrievalQA
from langchain.chains.query_constructor.base import AttributeInfo
from langchain.retrievers.self_query.base import SelfQueryRetriever

# Configuration
OLLAMA_BASE_URL = "http://localhost:11434"
MODEL_NAME = "hf.co/unsloth/Qwen3-8B-GGUF:Q4_K_XL"
KNOWLEDGE_BASE_FILE = "scripts/rag_knowledge_base.json"
EMBEDDING_MODEL = "paraphrase-multilingual-MiniLM-L12-v2"
MAX_CONCURRENT_REQUESTS = 3
REQUEST_TIMEOUT = 120 # Increased timeout for potentially slower RAG calls
BATCH_SIZE = 10
TOP_K = 10
OUTPUT_FILE = f"scripts/4-extracted_listing_details-Qwen3-8B-GGUF-Q4_K_XL-RAG_ONLY_all_subcategories.json"

class RAGSystem:
    """RAG system for performing all attribute extractions."""
    
    def __init__(self):
        self.llm = None
        self.retriever = None
        self.qa_chain = None
        self.initialized = False
    
    async def initialize(self):
        """Initialize the RAG system."""
        try:
            # Load knowledge base
            if not os.path.exists(KNOWLEDGE_BASE_FILE):
                print(f"⚠️ RAG knowledge base not found at '{KNOWLEDGE_BASE_FILE}'. Cannot proceed.")
                return
                
            with open(KNOWLEDGE_BASE_FILE, "r", encoding="utf-8") as f:
                kb = json.load(f)
            docs = [Document(page_content=entry["text"], metadata={"category": entry["category"]}) 
                    for entry in kb]

            # Build retriever
            embeddings = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL)

            # Use Chroma instead of FAISS
            vectorstore = Chroma.from_documents(docs, embeddings, collection_name="product_kb")

            # SelfQueryRetriever with metadata support

            # Set up Ollama LLM
            self.llm = Ollama(model=MODEL_NAME, base_url=OLLAMA_BASE_URL, temperature=0.7, top_p=0.8, top_k=20)
            
            
            self.retriever = SelfQueryRetriever.from_llm(
                llm=self.llm,
                vectorstore=vectorstore,
                document_contents="Product description and rules.",
                metadata_field_info=[AttributeInfo(name="category", description="Product category", type="string")],
                search_kwargs={"k": 10}
            )
            # Build RetrievalQA chain
            self.qa_chain = RetrievalQA.from_chain_type(
                llm=self.llm,
                retriever=self.retriever,
                return_source_documents=True,
                chain_type="stuff",
            )
            self.initialized = True
            print("✅ RAG system initialized successfully.")
        except Exception as e:
            print(f"❌ RAG initialization failed: {e}. The script cannot continue without it.")
            self.initialized = False

    async def extract_with_rag(self, prompt: str) -> dict:
        """Perform attribute extraction using the RAG chain."""
        if not self.initialized:
            print("⚠️ RAG system not initialized. Skipping extraction.")
            return {}

        try:
            # Run the QA chain in a separate thread to avoid blocking asyncio event loop
            result = await asyncio.to_thread(self.qa_chain.invoke, {"query": prompt})
            
            # Helper to find JSON in the model's output string
            def extract_json_from_string(s: str) -> str:
                # Remove everything before and including '</think>' if present
                if "</think>" in s:
                    s = s.split("</think>", 1)[1]
                match = re.search(r'\{.*\}', s, re.DOTALL)
                if match:
                    return match.group(0)
                raise ValueError("No JSON object found in the model's response string.")

            try:
                # Parse the RAG-enhanced attributes from the result
                json_str = extract_json_from_string(result["result"])
                rag_attributes = json.loads(json_str)

                if not rag_attributes or rag_attributes.get("Model") in [None, "null"]:
                    with open("scripts/failed_model_extractions.log", "a", encoding="utf-8") as f:
                        f.write(json.dumps({
                            "prompt": prompt,
                            "response": result["result"],
                            "sources": [doc.page_content for doc in result["source_documents"]]
                        }, ensure_ascii=False) + "\n")

                
                if isinstance(rag_attributes, dict):
                    # Add RAG metadata for traceability
                    rag_attributes["_rag_sources"] = [
                        doc.page_content for doc in result["source_documents"]
                    ]
                    rag_attributes["_rag_enhanced"] = True
                    return rag_attributes
                else:
                    print(f"⚠️ RAG output was not a JSON dictionary: {rag_attributes}")
                    return {}
            except (json.JSONDecodeError, ValueError) as e:
                print(f"⚠️ Failed to parse JSON from RAG response: {e}")
        except Exception as e:
            print(f"⚠️ RAG extraction process failed: {e}")
        
        return {}

# Initialize a single RAG system instance
rag_system = RAGSystem()

async def test_connection():
    """Test Ollama connection and model availability."""
    try:
        timeout = aiohttp.ClientTimeout(total=10)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(f"{OLLAMA_BASE_URL}/api/tags") as response:
                response.raise_for_status()
                data = await response.json()
                models = [model.get("name", "") for model in data.get("models", [])]
                
                if MODEL_NAME not in models:
                    print(f"❌ Error: Model '{MODEL_NAME}' not found. Available: {', '.join(models)}")
                    return False
                
                print(f"✅ Connected to Ollama with model '{MODEL_NAME}'")
                return True
    except Exception as e:
        print(f"❌ Connection to Ollama failed: {e}")
        return False

def create_prompt(title, description, category, existing_brand="Unknown"):
    """Creates a category-specific prompt for attribute extraction."""
    base_instruction = f"""/no_think Extract product attributes from this Finnish listing. Follow these rules:
1. Extract ONLY explicitly mentioned attributes.
2. Use "null" for missing or unclear values.
3. NEVER invent or assume values.
4. If the listing clearly mentions multiple brands or models, pick only one of them.
5. Your output MUST be ONLY a valid JSON object, with no additional text or explanations.

Listing Title: {title}
Listing Description: {description[:1000]}...
Known Brand: {existing_brand}
"""

    prompts = {
        "Pöytäkoneet": """
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
}}""",
        "Näytöt": """
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
}}""",
        "Matkapuhelimet": """
Return JSON format:
{{
"Brand": "brand or null",
"Model": "model only or null",
"Color": "color (in english lowercase) or null",
"RAM": "integer(RAM in GB) or null",
"Storage": "integer(storage in GB) or null",
"Battery_health": "integer(battery health in % if mentioned) or null",
"is_phone": "boolean(true if it is a phone, false if it's parts, accessories, or services)",
"confidence_score": "integer(0-100)"
}}""",
        "Tietokonekomponentit": """
Return JSON format:
{{
"Brand": "brand or null",
"Model": "model only or null",
"Type": "Graphics card, CPU, RAM, SSD, HDD, Motherboard, Power supply, Cooling, Case, etc. or null",
"RAM_type": "DDR3, DDR4, DDR5, etc. or null",
"RAM_amount": "integer(RAM in GB) or null",
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
}}""",
        "Kannettavat tietokoneet": """
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
""",
        "General": """
Return JSON format:
{{
"Brand": "brand or null",
"Model": "model only or null",
"Storage": "integer(storage in GB) or null",
"Color": "color (in english lowercase) or null",
"Year": "integer(year) or null",
"confidence_score": "integer(0-100)"
}}"""
    }
    
    return f"{base_instruction}\n{prompts.get(category, prompts['General'])}"

def get_existing_brand(listing):
    """Extract existing brand from listing details."""
    details = listing.get("details", {})
    for field in ["Brand", "Manufacturer"]:
        if field in details and details[field]:
            return str(details[field]).strip()
    return None

def get_category(listing):
    """Get listing category for prompt selection."""
    categories = listing.get("categories", [])
    if not categories:
        return "General"
    last_category = categories[-1]
    if "Pöytäkoneet" in last_category: return "Pöytäkoneet"
    if "Matkapuhelimet" in last_category: return "Matkapuhelimet"
    if "Näytöt" in last_category: return "Näytöt"
    if "Tietokonekomponentit" in last_category: return "Tietokonekomponentit"
    if "Kannettavat tietokoneet" in last_category: return "Kannettavat tietokoneet"
    return "General"

def clean_and_finalize_attributes(attributes, existing_brand):
    """Cleans, type-converts, and finalizes extracted attributes."""
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
                    del attributes[field] # Remove ambiguous value
            elif not isinstance(value, bool):
                del attributes[field] # Remove non-bool, non-string value

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
        if value is not None and str(value).lower() not in ["null", "unknown", "unclear", ""]:
            # Try to parse numbers for numeric fields
            if field in numeric_fields:
                try:
                    # Remove all non-digit characters except a period
                    num_str = re.sub(r'[^\d.]', '', str(value))
                    if num_str:
                        # Convert to int if possible, otherwise float
                        cleaned[field] = int(num_str) if '.' not in num_str else float(num_str)
                except (ValueError, TypeError):
                    pass # Skip if conversion fails
            else:
                 cleaned[field] = value
                 
    # Prioritize existing brand if available
    if existing_brand:
        cleaned["Brand"] = existing_brand

    # Add metadata
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

async def extract_attributes(listing):
    """Extract attributes from a single listing using the RAG system."""
    title = listing.get("title", "")
    description = listing.get("description", "")
    
    if not title and not description:
        return {"confidence": 0.0, "_extraction_confidence": 0.0}
    
    # Skip listings that are for a specific platform (e.g., PS4 games)
    if "Alusta" in listing.get("details", {}):
        return {"confidence": 1.0, "skipped": "platform"}
    
    existing_brand = get_existing_brand(listing)
    category = get_category(listing)
    prompt = create_prompt(title, description, category, existing_brand)
    
    # All extraction is now performed by the RAG system
    raw_attributes = await rag_system.extract_with_rag(prompt)
    
    if not raw_attributes:
        # Return a minimal dict if RAG extraction fails
        return {"confidence": 0.2, "_extraction_confidence": 0.2, "Brand": existing_brand} if existing_brand else {"confidence": 0.2, "_extraction_confidence": 0.2}
    
    # Clean, type-convert, and add metadata to the extracted attributes
    final_attributes = clean_and_finalize_attributes(raw_attributes, existing_brand)
    return final_attributes

async def process_listing(semaphore, listing):
    """Process a single listing with concurrency control."""
    async with semaphore:
        extracted = await extract_attributes(listing)
        
        enhanced_listing = copy.deepcopy(listing)
        
        if "skipped" in extracted:
            return enhanced_listing # Return original listing if skipped
        
        # Add extracted attributes to the details section
        if "details" not in enhanced_listing:
            enhanced_listing["details"] = {}
        enhanced_listing["details"].update(extracted)
        
        return enhanced_listing

async def process_batch(semaphore, batch, batch_num, total_batches):
    """Process a batch of listings concurrently."""
    print(f"⚙️ Processing batch {batch_num}/{total_batches} ({len(batch)} listings)...")
    
    tasks = [process_listing(semaphore, listing) for listing in batch]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    processed = []
    for i, res in enumerate(results):
        if isinstance(res, Exception):
            print(f"   - Error processing listing {batch[i].get('listing_id', 'N/A')}: {res}")
            processed.append(batch[i]) # Append original on error
        else:
            processed.append(res)
    
    return processed

def load_ids_to_skip(file_path='scripts/listings_from_db.txt'):
    """Load listing IDs from a file to skip them during processing."""
    if not os.path.exists(file_path):
        return set()
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return {line.strip() for line in f if line.strip()}
    except Exception as e:
        print(f"⚠️ Warning: Could not load IDs to skip from {file_path}: {e}")
        return set()

async def main():
    """Main execution function."""
    print("🚀 Starting RAG-based attribute extraction...")
    
    # Test connection to Ollama first
    if not await test_connection():
        return
        
    # Initialize the RAG system
    await rag_system.initialize()
    if not rag_system.initialized:
        print("❌ Script aborted due to RAG initialization failure.")
        return
    
    # Load data
    try:
        with open('scripts/3-scraped_listing_data.json', 'r', encoding='utf-8') as f:
            listings = json.load(f)
    except FileNotFoundError:
        print("❌ Error: 'scripts/3-scraped_listing_data.json' not found.")
        return
    except json.JSONDecodeError as e:
        print(f"❌ Error: Invalid JSON in input file - {e}")
        return
    
    ids_to_skip = load_ids_to_skip()
    print(f"🔍 Found {len(ids_to_skip)} IDs to skip from the database file.")
    
    # Filter for new, successful listings
    successful = [
        l for l in listings 
        if l.get("status") == "success" and str(l.get("listing_id")) not in ids_to_skip
    ]
    if not successful:
        print("✅ No new listings to process.")
        return
        
    print(f"✨ Processing {len(successful)} new successful listings...")
    
    # Setup concurrency
    semaphore = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)
    batches = [successful[i:i + BATCH_SIZE] for i in range(0, len(successful), BATCH_SIZE)]
    
    start_time = time.time()
    
    # Load existing results to append to
    all_results = []
    if os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
                all_results = json.load(f)
            print(f"📂 Loaded {len(all_results)} existing results from '{OUTPUT_FILE}'.")
        except Exception as e:
            print(f"⚠️ Could not load existing results: {e}. Starting fresh.")
            all_results = []

    # Process all batches
    try:
        for batch_num, batch in enumerate(batches, 1):
            batch_results = await process_batch(semaphore, batch, batch_num, len(batches))
            all_results.extend(batch_results)
            
            # Save progress periodically
            if batch_num % 5 == 0 or batch_num == len(batches):
                with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
                    json.dump(all_results, f, ensure_ascii=False, indent=2)
                print(f"   💾 Progress saved ({len(all_results)} total listings).")
            
            if batch_num < len(batches):
                await asyncio.sleep(0.1) # Brief pause between batches
    
    except Exception as e:
        print(f"❌ An unexpected error occurred during processing: {e}")
    
    finally:
        # Final save
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            json.dump(all_results, f, ensure_ascii=False, indent=2)
        
        # --- Final Statistics ---
        total_time = time.time() - start_time
        processed_count = len(all_results)
        extracted_listings = [
            r for r in all_results 
            if r.get("details", {}).get("_extraction_confidence", 0) > 0 and "skipped" not in r.get("details", {})
        ]
        extracted_count = len(extracted_listings)
        
        if extracted_count > 0:
            avg_confidence = sum(r.get("details", {}).get("_extraction_confidence", 0) for r in extracted_listings) / extracted_count
        else:
            avg_confidence = 0

        print("\n" + "="*50)
        print("✅ Extraction complete!")
        print(f"⏱️  Total time: {total_time:.2f}s")
        print(f"📊 Processed listings: {processed_count}")
        print(f"🎯 Extracted attributes for: {extracted_count} listings ({extracted_count/processed_count*100:.1f}%)")
        print(f"📈 Average confidence: {avg_confidence:.2f}")
        print(f"💾 All results saved to: {OUTPUT_FILE}")
        print("="*50)

if __name__ == "__main__":
    asyncio.run(main())