# PDF RAG Implementation - Merge Instructions

## Overview
This branch (`feature/pdf-rag-implementation`) adds comprehensive PDF upload and RAG (Retrieval-Augmented Generation) functionality to the AI Maker Space application.

## Features Added
- **PDF Upload**: Users can upload PDF files through the web interface
- **PDF Processing**: Automatic text extraction and chunking using the aimakerspace library
- **Vector Database**: PDF content is indexed using OpenAI embeddings
- **RAG Chat**: Users can ask questions about uploaded PDFs and get context-aware answers
- **Chat Mode Toggle**: Switch between general AI chat and PDF-specific RAG chat
- **Multiple PDF Support**: Upload and select from multiple PDFs

## Technical Implementation
- **Backend**: FastAPI endpoints for PDF upload and RAG chat
- **Frontend**: React components for file upload and chat mode selection
- **AI Integration**: Uses aimakerspace library for PDF processing and vector search
- **Streaming**: Real-time response streaming for both chat modes

## Files Modified
- `api/app.py` - Added PDF upload and RAG chat endpoints
- `api/requirements.txt` - Added new dependencies
- `frontend/src/App.tsx` - Added PDF upload UI and chat mode switching
- `frontend/src/App.css` - Styled new PDF upload components

## How to Test Locally

### Prerequisites
- Python 3.13+ with uv package manager
- Node.js and npm
- OpenAI API key

### Setup Instructions
1. **Clone and setup virtual environment:**
   ```bash
   cd /path/to/ai-maker-space
   uv venv --clear
   source .venv/bin/activate.fish  # or .venv/bin/activate for bash
   ```

2. **Install dependencies:**
   ```bash
   uv pip install -e .
   cd api
   uv pip install -r requirements.txt
   ```

3. **Start backend server:**
   ```bash
   python app.py
   ```
   Backend runs on: http://localhost:8000

4. **Start frontend (new terminal):**
   ```bash
   cd frontend
   npm install
   npm start
   ```
   Frontend runs on: http://localhost:3000

### Testing the PDF RAG Feature
1. Open browser to http://localhost:3000
2. Enter your OpenAI API key in the settings
3. Switch to "PDF RAG Chat" mode
4. Upload a PDF file (it will be processed automatically)
5. Select the uploaded PDF from the dropdown
6. Ask questions about the PDF content
7. The AI will respond based only on the PDF content

## Merge Options

### Option 1: GitHub Pull Request
```bash
git push origin feature/pdf-rag-implementation
```
Then create a PR on GitHub from `feature/pdf-rag-implementation` to `main`.

### Option 2: GitHub CLI
```bash
# Push the branch
git push origin feature/pdf-rag-implementation

# Create PR using GitHub CLI
gh pr create --title "Add PDF RAG functionality" --body "Implements PDF upload and RAG chat system using aimakerspace library. Allows users to upload PDFs and ask questions about their content with context-aware AI responses."

# Merge when ready
gh pr merge --squash
```

### Option 3: Direct Merge (if you have permissions)
```bash
git checkout main
git merge feature/pdf-rag-implementation
git push origin main
```

## Deployment Notes
- Ensure all dependencies in `api/requirements.txt` are installed in production
- The aimakerspace library must be installed (`pip install -e .`)
- OpenAI API keys are required for both embedding generation and chat responses
- PDF files are processed in memory and not permanently stored
- Vector databases are stored in memory and will be lost on server restart

## Architecture
```
Frontend (React) → Backend (FastAPI) → aimakerspace library → OpenAI API
                                   ↓
                              Vector Database (in-memory)
```

## Security Considerations
- API keys are handled client-side and passed to backend
- PDF files are temporarily stored during processing then deleted
- No persistent storage of user data or PDFs
- CORS is configured for local development

## Future Enhancements
- Persistent vector database storage
- Multiple file format support
- User authentication and PDF management
- Advanced chunking strategies
- Metadata extraction and filtering
