# Import required FastAPI components for building the API
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
# Import Pydantic for data validation and settings management
from pydantic import BaseModel
# Import OpenAI client for interacting with OpenAI's API
from openai import OpenAI
import os
import logging
from typing import Optional

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI application with a title
app = FastAPI(title="OpenAI Chat API")

# Configure CORS (Cross-Origin Resource Sharing) middleware
# This allows the API to be accessed from different domains/origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows requests from any origin
    allow_credentials=True,  # Allows cookies to be included in requests
    allow_methods=["*"],  # Allows all HTTP methods (GET, POST, etc.)
    allow_headers=["*"],  # Allows all headers in requests
)

# Define the data model for chat requests using Pydantic
# This ensures incoming request data is properly validated
class ChatRequest(BaseModel):
    developer_message: str  # Message from the developer/system
    user_message: str      # Message from the user
    model: Optional[str] = "gpt-4.1-mini"  # Optional model selection with default
    api_key: str          # OpenAI API key for authentication

# Root endpoint for testing
@app.get("/")
async def root():
    return {"message": "AI Maker Space API is running!"}

# Define the main chat endpoint that handles POST requests
@app.post("/api/chat")
async def chat(request: ChatRequest):
    try:
        logger.info(f"Received chat request with model: {request.model}")
        
        # Validate API key
        if not request.api_key or request.api_key.strip() == "":
            raise HTTPException(status_code=400, detail="API key is required")
        
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
