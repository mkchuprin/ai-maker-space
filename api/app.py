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
app = FastAPI(title="AI Maker Space - PDF RAG Chat API")

# Global state for storing PDF vector databases
pdf_databases: Dict[str, VectorDatabase] = {}

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

# Root endpoint for testing
@app.get("/")
async def root():
    return {"message": "AI Maker Space API is running!"}

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
