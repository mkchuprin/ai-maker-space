# Import required FastAPI components for building the API
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
# Import Pydantic for data validation and settings management
from pydantic import BaseModel
# Import OpenAI client for interacting with OpenAI's API
from openai import OpenAI
import os
import logging
import tempfile
import shutil
from typing import Optional, Dict, Any
from pathlib import Path

# Import aimakerspace library components
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from aimakerspace.text_utils import PDFLoader, CharacterTextSplitter
from aimakerspace.vectordatabase import VectorDatabase
from aimakerspace.openai_utils.embedding import EmbeddingModel
from aimakerspace.openai_utils.chatmodel import ChatOpenAI

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI application with a title
app = FastAPI(title="AI Maker Space - System Design Interview API")

# Global state for storing PDF vector databases
pdf_databases: Dict[str, VectorDatabase] = {}
# Global system design knowledge base
system_design_knowledge: VectorDatabase = None
# Interview state
interview_sessions: Dict[str, Dict[str, Any]] = {}

# Configure CORS (Cross-Origin Resource Sharing) middleware
# This allows the API to be accessed from different domains/origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001", 
        "https://*.vercel.app",
        "https://*.vercel.com",
        "*"  # Fallback for any other origins
    ],
    allow_credentials=True,  # Allows cookies to be included in requests
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],  # Explicit methods
    allow_headers=[
        "Accept",
        "Accept-Language",
        "Content-Language",
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "Origin",
        "Access-Control-Request-Method",
        "Access-Control-Request-Headers"
    ],
    expose_headers=["Content-Length", "Content-Type"],
    max_age=86400,  # Cache preflight requests for 24 hours
)

# Define the data model for chat requests using Pydantic
# This ensures incoming request data is properly validated
class ChatRequest(BaseModel):
    developer_message: str  # Message from the developer/system
    user_message: str      # Message from the user
    model: Optional[str] = "gpt-4.1-mini"  # Optional model selection with default
    api_key: str          # OpenAI API key for authentication

# Define the data model for PDF RAG chat requests
class PDFChatRequest(BaseModel):
    user_message: str      # Message from the user
    pdf_id: str           # ID of the uploaded PDF
    model: Optional[str] = "gpt-4.1-mini"  # Optional model selection with default
    api_key: str          # OpenAI API key for authentication

# Define the response model for PDF upload
class PDFUploadResponse(BaseModel):
    pdf_id: str
    filename: str
    message: str
    chunk_count: int

# Interview request/response models
class InterviewStartRequest(BaseModel):
    session_id: str
    system_requirements: str
    api_key: str
    output_preferences: Optional[Dict[str, bool]] = None

class InterviewQuestionRequest(BaseModel):
    session_id: str
    user_answer: str
    api_key: str

class InterviewResponse(BaseModel):
    session_id: str
    question: Optional[str] = None
    is_complete: bool = False
    sequence_diagram: Optional[str] = None
    high_level_design: Optional[str] = None
    database_schema: Optional[str] = None
    api_design: Optional[str] = None
    deployment_diagram: Optional[str] = None
    system_design: Optional[str] = None
    progress: int = 0

async def load_system_design_pdfs():
    """Load and index all PDFs from the system_design_pdfs folder on startup."""
    global system_design_knowledge
    
    try:
        # Set a default API key for startup (will be overridden by user's key)
        os.environ.setdefault("OPENAI_API_KEY", "dummy-key-for-startup")
        
        pdf_folder = Path("../system_design_pdfs")
        if not pdf_folder.exists():
            logger.warning("system_design_pdfs folder not found")
            return
        
        pdf_files = list(pdf_folder.glob("*.pdf"))
        if not pdf_files:
            logger.info("No PDF files found in system_design_pdfs folder")
            return
        
        logger.info(f"Found {len(pdf_files)} PDF files to index")
        all_chunks = []
        
        for pdf_file in pdf_files:
            logger.info(f"Processing {pdf_file.name}")
            pdf_loader = PDFLoader(str(pdf_file))
            pdf_loader.load_file()
            
            if pdf_loader.documents:
                text_splitter = CharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
                chunks = text_splitter.split_texts(pdf_loader.documents)
                # Add filename context to chunks
                contextual_chunks = [f"[From {pdf_file.name}]: {chunk}" for chunk in chunks]
                all_chunks.extend(contextual_chunks)
                logger.info(f"Added {len(chunks)} chunks from {pdf_file.name}")
        
        if all_chunks:
            # Create knowledge base (will be initialized properly when user provides API key)
            system_design_knowledge = VectorDatabase()
            logger.info(f"System design knowledge base ready with {len(all_chunks)} chunks")
        
    except Exception as e:
        logger.error(f"Error loading system design PDFs: {str(e)}")

@app.on_event("startup")
async def startup_event():
    """Initialize the system design knowledge base on startup."""
    await load_system_design_pdfs()

# Root endpoint for testing
@app.get("/")
async def root():
    return {"message": "AI Maker Space System Design Interview API is running!"}

# PDF Upload endpoint
@app.post("/api/upload-pdf", response_model=PDFUploadResponse)
async def upload_pdf(
    file: UploadFile = File(...),
    api_key: str = Form(...)
):
    """Upload a PDF file and create a vector database for RAG."""
    try:
        logger.info(f"Received PDF upload request: {file.filename}")
        
        # Validate API key
        if not api_key or api_key.strip() == "":
            raise HTTPException(status_code=400, detail="API key is required")
        
        if not api_key.startswith("sk-"):
            raise HTTPException(status_code=400, detail="Invalid API key format")
        
        # Validate file type
        if not file.filename or not file.filename.lower().endswith('.pdf'):
            raise HTTPException(status_code=400, detail="Only PDF files are allowed")
        
        # Set OpenAI API key for aimakerspace library
        os.environ["OPENAI_API_KEY"] = api_key
        
        # Create temporary file to store uploaded PDF
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
            shutil.copyfileobj(file.file, temp_file)
            temp_path = temp_file.name
        
        try:
            # Load PDF using aimakerspace library
            pdf_loader = PDFLoader(temp_path)
            pdf_loader.load_file()
            
            if not pdf_loader.documents:
                raise HTTPException(status_code=400, detail="No text could be extracted from the PDF")
            
            # Split text into chunks
            text_splitter = CharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
            chunks = text_splitter.split_texts(pdf_loader.documents)
            
            logger.info(f"Created {len(chunks)} chunks from PDF")
            
            # Create vector database
            embedding_model = EmbeddingModel()
            vector_db = VectorDatabase(embedding_model)
            
            # Build vector database asynchronously
            import asyncio
            await vector_db.abuild_from_list(chunks)
            
            # Generate unique PDF ID
            import uuid
            pdf_id = str(uuid.uuid4())
            
            # Store vector database globally
            pdf_databases[pdf_id] = vector_db
            
            logger.info(f"Successfully processed PDF {file.filename} with ID {pdf_id}")
            
            return PDFUploadResponse(
                pdf_id=pdf_id,
                filename=file.filename,
                message=f"PDF processed successfully. Created {len(chunks)} text chunks.",
                chunk_count=len(chunks)
            )
            
        finally:
            # Clean up temporary file
            os.unlink(temp_path)
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing PDF: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing PDF: {str(e)}")

# Get uploaded PDFs endpoint
@app.get("/api/pdfs")
async def get_uploaded_pdfs():
    """Get list of uploaded PDFs."""
    return {
        "pdfs": [
            {
                "pdf_id": pdf_id,
                "chunk_count": len(vector_db.vectors)
            }
            for pdf_id, vector_db in pdf_databases.items()
        ]
    }

# Interview endpoints
@app.post("/api/interview/start", response_model=InterviewResponse)
async def start_interview(request: InterviewStartRequest):
    """Start a new system design interview session."""
    try:
        global system_design_knowledge
        
        # Validate API key
        if not request.api_key or not request.api_key.startswith("sk-"):
            raise HTTPException(status_code=400, detail="Valid OpenAI API key required")
        
        # Set API key for this session
        os.environ["OPENAI_API_KEY"] = request.api_key
        
        # Initialize system design knowledge base if not done
        if system_design_knowledge is None:
            await load_system_design_pdfs()
        
        # Initialize system design knowledge base with embeddings
        if system_design_knowledge and len(system_design_knowledge.vectors) == 0:
            # Re-load and index with proper API key
            pdf_folder = Path("../system_design_pdfs")
            all_chunks = []
            
            for pdf_file in pdf_folder.glob("*.pdf"):
                pdf_loader = PDFLoader(str(pdf_file))
                pdf_loader.load_file()
                
                if pdf_loader.documents:
                    text_splitter = CharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
                    chunks = text_splitter.split_texts(pdf_loader.documents)
                    contextual_chunks = [f"[From {pdf_file.name}]: {chunk}" for chunk in chunks]
                    all_chunks.extend(contextual_chunks)
            
            if all_chunks:
                embedding_model = EmbeddingModel()
                system_design_knowledge = VectorDatabase(embedding_model)
                await system_design_knowledge.abuild_from_list(all_chunks)
                logger.info(f"Indexed {len(all_chunks)} chunks for system design knowledge")
        
        # Initialize interview session
        interview_sessions[request.session_id] = {
            "requirements": request.system_requirements,
            "current_question": 0,
            "answers": [],
            "api_key": request.api_key,
            "output_preferences": request.output_preferences or {
                "sequenceDiagram": True,
                "highLevelDesign": True,
                "databaseSchema": False,
                "apiDesign": False,
                "deploymentDiagram": False,
                "systemDesignDoc": True
            }
        }
        
        # Generate first question
        first_question = await generate_interview_question(request.session_id, request.system_requirements, None)
        
        return InterviewResponse(
            session_id=request.session_id,
            question=first_question,
            progress=10
        )
        
    except Exception as e:
        logger.error(f"Error starting interview: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/interview/answer", response_model=InterviewResponse)
async def answer_question(request: InterviewQuestionRequest):
    """Process user's answer and provide next question or final design."""
    try:
        if request.session_id not in interview_sessions:
            raise HTTPException(status_code=404, detail="Interview session not found")
        
        session = interview_sessions[request.session_id]
        session["answers"].append(request.user_answer)
        session["current_question"] += 1
        
        # Set API key
        os.environ["OPENAI_API_KEY"] = session["api_key"]
        
        # Check if we have enough answers (5 questions total)
        if session["current_question"] >= 5:
            # Generate final designs based on user preferences
            outputs = await generate_final_design(request.session_id)
            
            return InterviewResponse(
                session_id=request.session_id,
                is_complete=True,
                sequence_diagram=outputs.get("sequence_diagram"),
                high_level_design=outputs.get("high_level_design"),
                database_schema=outputs.get("database_schema"),
                api_design=outputs.get("api_design"),
                deployment_diagram=outputs.get("deployment_diagram"),
                system_design=outputs.get("system_design"),
                progress=100
            )
        
        # Generate next question
        next_question = await generate_interview_question(
            request.session_id, 
            session["requirements"], 
            request.user_answer
        )
        
        progress = min(90, (session["current_question"] + 1) * 20)
        
        return InterviewResponse(
            session_id=request.session_id,
            question=next_question,
            progress=progress
        )
        
    except Exception as e:
        logger.error(f"Error processing answer: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

async def generate_interview_question(session_id: str, requirements: str, previous_answer: Optional[str]) -> str:
    """Generate the next interview question based on system design knowledge."""
    session = interview_sessions[session_id]
    question_number = session["current_question"] + 1
    
    # Get relevant context from system design knowledge
    context = ""
    if system_design_knowledge:
        search_query = f"{requirements} system design question {question_number}"
        relevant_chunks = system_design_knowledge.search_by_text(search_query, k=3, return_as_text=True)
        context = "\n".join(relevant_chunks)
    
    # Question templates with multiple choice options for easier answering
    question_templates = [
        {
            "question": "Let's start with scale estimation. What's your expected user base and traffic for this system?",
            "options": [
                "A) Small scale: <10K users, <100 requests/sec",
                "B) Medium scale: 10K-1M users, 100-10K requests/sec", 
                "C) Large scale: 1M-100M users, 10K-100K requests/sec",
                "D) Massive scale: >100M users, >100K requests/sec"
            ]
        },
        {
            "question": "What's your preferred high-level architecture pattern for this system?",
            "options": [
                "A) Monolithic architecture with single database",
                "B) Microservices with API gateway and service mesh",
                "C) Serverless functions with managed services",
                "D) Hybrid approach mixing monolith and microservices"
            ]
        },
        {
            "question": "Which database strategy would you choose for the core data storage?",
            "options": [
                "A) Single SQL database (PostgreSQL/MySQL) with read replicas",
                "B) NoSQL database (MongoDB/DynamoDB) for flexibility",
                "C) Multi-database approach (SQL + NoSQL + Cache)",
                "D) Distributed database system (Cassandra/CockroachDB)"
            ]
        },
        {
            "question": "How would you handle scaling and performance optimization?",
            "options": [
                "A) Vertical scaling with powerful servers and caching",
                "B) Horizontal scaling with load balancers and CDN",
                "C) Auto-scaling with cloud services and containers",
                "D) Global distribution with multiple data centers"
            ]
        },
        {
            "question": "What's your approach to reliability and fault tolerance?",
            "options": [
                "A) Basic monitoring with backup systems and alerts",
                "B) Circuit breakers, retries, and graceful degradation",
                "C) Multi-region deployment with disaster recovery",
                "D) Chaos engineering and self-healing systems"
            ]
        }
    ]
    
    base_question_template = question_templates[min(question_number - 1, len(question_templates) - 1)]
    
    # Use AI to customize the question for the specific system
    chat_model = ChatOpenAI(model_name="gpt-4o-mini")
    
    system_prompt = f"""You are conducting a system design interview. The candidate needs to design: {requirements}

CONTEXT FROM SYSTEM DESIGN KNOWLEDGE:
{context}

Current question number: {question_number}/5
Previous answer: {previous_answer or "None (this is the first question)"}

Base question template: {base_question_template['question']}
Available options: {chr(10).join(base_question_template['options'])}

Customize the question to be specific for designing "{requirements}" while keeping the multiple choice format. 
Make the question clear and the options relevant to this specific system.

Return the response in this exact format:
QUESTION: [your customized question]
OPTIONS:
A) [option A]
B) [option B] 
C) [option C]
D) [option D]

Keep it concise and focused on the specific system being designed."""
    
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Customize the question for designing: {requirements}"}
    ]
    
    response = chat_model.run(messages)
    
    # If AI customization fails, fall back to template
    if "QUESTION:" not in response or "OPTIONS:" not in response:
        formatted_question = f"{base_question_template['question']}\n\nOptions:\n" + "\n".join(base_question_template['options'])
        return formatted_question
    
    return response

async def generate_final_design(session_id: str) -> Dict[str, str]:
    """Generate final designs based on user preferences."""
    session = interview_sessions[session_id]
    requirements = session["requirements"]
    answers = session["answers"]
    preferences = session["output_preferences"]
    
    # Get comprehensive context from system design knowledge
    context = ""
    if system_design_knowledge:
        search_queries = [
            f"{requirements} architecture diagram",
            f"{requirements} system components",
            f"{requirements} database design",
            f"{requirements} scalability patterns"
        ]
        
        all_chunks = []
        for query in search_queries:
            chunks = system_design_knowledge.search_by_text(query, k=3, return_as_text=True)
            all_chunks.extend(chunks)
        
        context = "\n".join(set(all_chunks))  # Remove duplicates
    
    chat_model = ChatOpenAI(model_name="gpt-4o")
    outputs = {}
    
    base_context = f"""Based on the system design interview for: {requirements}

ANSWERS PROVIDED:
{chr(10).join([f"Q{i+1}: {answer}" for i, answer in enumerate(answers)])}

SYSTEM DESIGN KNOWLEDGE CONTEXT:
{context}"""

    # Generate Sequence Diagram
    if preferences.get("sequenceDiagram", False):
        sequence_prompt = f"""{base_context}

Generate a detailed Mermaid sequence diagram showing the flow of a typical user request through the system.

Requirements:
1. Use proper Mermaid sequence diagram syntax
2. Include all major components (client, load balancer, API gateway, services, databases, caches, etc.)
3. Show the complete request/response flow
4. Include error handling paths
5. Add notes for important design decisions
6. Return ONLY the mermaid code, no markdown formatting, no explanations

The output should be ready to copy-paste into mermaid.live"""

        messages = [{"role": "system", "content": "You are a senior system architect. Generate only the mermaid sequence diagram code."}, {"role": "user", "content": sequence_prompt}]
        outputs["sequence_diagram"] = chat_model.run(messages)

    # Generate High-Level Design
    if preferences.get("highLevelDesign", False):
        design_prompt = f"""{base_context}

Generate a Mermaid architecture diagram showing the high-level system components and their relationships.

Requirements:
1. Use Mermaid graph or flowchart syntax
2. Show all major system components (load balancer, services, databases, caches, external APIs)
3. Include data flow and component relationships
4. Add labels for technologies and patterns used
5. Return ONLY the mermaid code, no markdown formatting

The output should be ready to copy-paste into mermaid.live"""

        messages = [{"role": "system", "content": "Generate only the mermaid architecture diagram code."}, {"role": "user", "content": design_prompt}]
        outputs["high_level_design"] = chat_model.run(messages)

    # Generate Database Schema
    if preferences.get("databaseSchema", False):
        db_prompt = f"""{base_context}

Generate a Mermaid ER diagram showing the database schema and relationships.

Requirements:
1. Use Mermaid ER diagram syntax
2. Show all entities, attributes, and relationships
3. Include primary keys, foreign keys, and indexes
4. Add cardinality information
5. Return ONLY the mermaid code, no markdown formatting

The output should be ready to copy-paste into mermaid.live"""

        messages = [{"role": "system", "content": "Generate only the mermaid ER diagram code."}, {"role": "user", "content": db_prompt}]
        outputs["database_schema"] = chat_model.run(messages)

    # Generate API Design
    if preferences.get("apiDesign", False):
        api_prompt = f"""{base_context}

Generate a comprehensive API design document with all endpoints, request/response formats, and authentication.

Include:
1. RESTful API endpoints with HTTP methods
2. Request/response schemas
3. Authentication and authorization
4. Error handling
5. Rate limiting and pagination
6. API versioning strategy"""

        messages = [{"role": "system", "content": "Generate a detailed API design document."}, {"role": "user", "content": api_prompt}]
        outputs["api_design"] = chat_model.run(messages)

    # Generate Deployment Diagram
    if preferences.get("deploymentDiagram", False):
        deployment_prompt = f"""{base_context}

Generate a Mermaid deployment diagram showing how the system is deployed in production.

Requirements:
1. Use Mermaid deployment or graph syntax
2. Show servers, containers, load balancers, databases
3. Include cloud services and infrastructure components
4. Show network boundaries and security zones
5. Return ONLY the mermaid code, no markdown formatting

The output should be ready to copy-paste into mermaid.live"""

        messages = [{"role": "system", "content": "Generate only the mermaid deployment diagram code."}, {"role": "user", "content": deployment_prompt}]
        outputs["deployment_diagram"] = chat_model.run(messages)

    # Generate System Design Document
    if preferences.get("systemDesignDoc", False):
        doc_prompt = f"""{base_context}

Generate a comprehensive, production-ready system design document that includes:

1. **System Overview**
2. **Architecture Components**
3. **Database Design**
4. **API Design**
5. **Scalability Strategy**
6. **Reliability & Fault Tolerance**
7. **Security Considerations**
8. **Monitoring & Observability**
9. **Deployment Strategy**
10. **Cost Optimization**

Make it detailed, technical, and production-ready. Include specific technologies, patterns, and best practices."""

        messages = [{"role": "system", "content": "You are a senior system architect creating production-ready system designs."}, {"role": "user", "content": doc_prompt}]
        outputs["system_design"] = chat_model.run(messages)
    
    return outputs

# Preflight handler for CORS
@app.options("/api/chat")
async def preflight_chat():
    return {"message": "OK"}

# Preflight handler for PDF chat
@app.options("/api/pdf-chat")
async def preflight_pdf_chat():
    return {"message": "OK"}

# PDF RAG Chat endpoint
@app.post("/api/pdf-chat")
async def pdf_chat(request: PDFChatRequest):
    """Chat with a PDF using RAG (Retrieval-Augmented Generation)."""
    try:
        logger.info(f"Received PDF chat request for PDF ID: {request.pdf_id}")
        
        # Validate API key
        if not request.api_key or request.api_key.strip() == "":
            raise HTTPException(status_code=400, detail="API key is required")
        
        if not request.api_key.startswith("sk-"):
            raise HTTPException(status_code=400, detail="Invalid API key format")
        
        # Check if PDF exists
        if request.pdf_id not in pdf_databases:
            raise HTTPException(status_code=404, detail="PDF not found. Please upload the PDF first.")
        
        # Set OpenAI API key for aimakerspace library
        os.environ["OPENAI_API_KEY"] = request.api_key
        
        # Get vector database for the PDF
        vector_db = pdf_databases[request.pdf_id]
        
        # Search for relevant chunks
        relevant_chunks = vector_db.search_by_text(
            request.user_message, 
            k=5,  # Get top 5 most relevant chunks
            return_as_text=True
        )
        
        if not relevant_chunks:
            raise HTTPException(status_code=400, detail="No relevant content found in the PDF for your question.")
        
        # Create context from relevant chunks
        context = "\n\n".join(relevant_chunks)
        
        # Create system message for RAG
        system_message = f"""You are a helpful AI assistant that answers questions based ONLY on the provided context from a PDF document. 

IMPORTANT RULES:
1. Only use information from the provided context below
2. If the answer cannot be found in the context, say "I cannot find the answer to your question in the provided PDF document."
3. Do not make up information or use external knowledge
4. Be precise and cite relevant parts of the context when possible

CONTEXT FROM PDF:
{context}

Now answer the user's question based on this context:"""
        
        # Initialize ChatOpenAI
        chat_model = ChatOpenAI(model_name=request.model)
        
        # Create messages for chat
        messages = [
            {"role": "system", "content": system_message},
            {"role": "user", "content": request.user_message}
        ]
        
        # Create streaming response
        async def generate():
            try:
                logger.info("Starting PDF RAG chat streaming")
                async for chunk in chat_model.astream(messages):
                    yield chunk
            except Exception as stream_error:
                logger.error(f"Error in PDF chat streaming: {str(stream_error)}")
                yield f"Error: {str(stream_error)}"
        
        return StreamingResponse(generate(), media_type="text/plain")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in PDF chat endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

# Define the main chat endpoint that handles POST requests
@app.post("/api/chat")
async def chat(request: ChatRequest):
    try:
        logger.info(f"Received chat request with model: {request.model}")
        
        # Debug: Log the API key (masked for security)
        api_key_preview = request.api_key[:10] + "..." if len(request.api_key) > 10 else request.api_key
        logger.info(f"Received API key: {api_key_preview} (length: {len(request.api_key)})")
        
        # Validate API key
        if not request.api_key or request.api_key.strip() == "":
            raise HTTPException(status_code=400, detail="API key is required")
        
        # Check if API key looks valid (should start with sk-)
        if not request.api_key.startswith("sk-"):
            logger.error(f"Invalid API key format: {api_key_preview}")
            raise HTTPException(status_code=400, detail="Invalid API key format. API key should start with 'sk-'")
        
        # Initialize OpenAI client with the provided API key
        client = OpenAI(api_key=request.api_key)
        
        # Create an async generator function for streaming responses
        async def generate():
            try:
                logger.info("Creating OpenAI chat completion request")
                # Create a streaming chat completion request
                stream = client.chat.completions.create(
                    model=request.model,
                    messages=[
                        {"role": "system", "content": request.developer_message},
                        {"role": "user", "content": request.user_message}
                    ],
                    stream=True  # Enable streaming response
                )
                
                logger.info("Stream created successfully, yielding chunks")
                # Yield each chunk of the response as it becomes available
                for chunk in stream:
                    if chunk.choices[0].delta.content is not None:
                        yield chunk.choices[0].delta.content
                        
            except Exception as stream_error:
                logger.error(f"Error in streaming: {str(stream_error)}")
                yield f"Error: {str(stream_error)}"

        # Return a streaming response to the client
        return StreamingResponse(generate(), media_type="text/plain")
    
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        # Log the error for debugging
        logger.error(f"Unexpected error in chat endpoint: {str(e)}")
        logger.error(f"Error type: {type(e).__name__}")
        # Handle any errors that occur during processing
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

# Define a health check endpoint to verify API status
@app.get("/api/health")
async def health_check():
    return {"status": "ok"}

# Add a simple test endpoint
@app.get("/api/test")
async def test_endpoint():
    return {"message": "API is working!", "method": "GET"}

@app.post("/api/test")
async def test_post_endpoint():
    return {"message": "POST endpoint is working!", "method": "POST"}

# Add a test chat endpoint that doesn't require OpenAI API
@app.post("/api/chat-test")
async def chat_test(request: ChatRequest):
    """Test endpoint that simulates chat response without OpenAI API call"""
    try:
        logger.info(f"Received test chat request with model: {request.model}")
        
        # Validate API key
        if not request.api_key or request.api_key.strip() == "":
            raise HTTPException(status_code=400, detail="API key is required")
        
        # Create an async generator function for streaming responses
        async def generate():
            try:
                logger.info("Generating test response")
                # Simulate a streaming response
                test_response = f"Test response: You said '{request.user_message}' and the system message is '{request.developer_message}'. This is a test response without calling OpenAI API."
                
                # Yield the response in chunks to simulate streaming
                for i in range(0, len(test_response), 10):
                    chunk = test_response[i:i+10]
                    yield chunk
                    import asyncio
                    await asyncio.sleep(0.1)  # Small delay to simulate streaming
                        
            except Exception as stream_error:
                logger.error(f"Error in test streaming: {str(stream_error)}")
                yield f"Error: {str(stream_error)}"

        # Return a streaming response to the client
        return StreamingResponse(generate(), media_type="text/plain")
    
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        # Log the error for debugging
        logger.error(f"Unexpected error in test chat endpoint: {str(e)}")
        logger.error(f"Error type: {type(e).__name__}")
        # Handle any errors that occur during processing
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

# Entry point for running the application directly
if __name__ == "__main__":
    import uvicorn
    # Start the server on all network interfaces (0.0.0.0) on port 8000
    uvicorn.run(app, host="0.0.0.0", port=8000)
