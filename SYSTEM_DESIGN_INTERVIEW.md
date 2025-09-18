# System Design Interview Application

## 🎯 Overview

This application conducts structured system design interviews using AI, referencing uploaded PDF knowledge bases. It generates production-ready system designs and Mermaid diagrams that can be directly used in mermaid.live.

## 📁 Setup Instructions

### 1. Add Your System Design PDFs

1. **Place PDFs in the `system_design_pdfs/` folder**
   - Add any system design references (architecture patterns, best practices, etc.)
   - The app automatically indexes all PDFs on startup
   - PDFs provide context for generating interview questions

2. **Supported Content:**
   - System design interview guides
   - Architecture patterns documentation
   - Scalability best practices
   - Database design principles
   - Microservices patterns
   - Any technical documentation

### 2. Start the Application

```bash
# Activate virtual environment
source .venv/bin/activate.fish  # or .venv/bin/activate for bash

# Start backend (from project root)
cd api && python app.py

# Start frontend (new terminal)
cd frontend && npm start
```

- **Backend:** http://localhost:8000
- **Frontend:** http://localhost:3000

## 🎪 How to Use

### Step 1: Configure Settings
1. **Enter OpenAI API Key** in the settings panel
2. **Select "System Design Interview" mode** (default)
3. **Enter system requirements** (e.g., "Design a chat application like WhatsApp")

### Step 2: Start Interview
1. Click **"🎯 Start System Design Interview"**
2. The system will generate the first contextual question
3. Progress bar shows interview completion (0-100%)

### Step 3: Answer Questions
1. **5 structured questions** covering:
   - Requirements gathering & scale
   - High-level architecture
   - Database design
   - Scalability strategies
   - Reliability & monitoring

2. Each question is **contextually generated** using:
   - Your system requirements
   - Previous answers
   - Knowledge from uploaded PDFs

### Step 4: Get Final Design
After 5 questions, receive:
1. **Mermaid Sequence Diagram** (copy-paste ready for mermaid.live)
2. **Complete System Design Document** (production-ready)

## 📊 Output Examples

### Mermaid Diagram Output
The application generates **plain text Mermaid code** like this:

```
sequenceDiagram
    participant U as User
    participant LB as Load Balancer
    participant API as API Gateway
    participant AS as Auth Service
    participant MS as Message Service
    participant DB as Database
    participant C as Cache
    
    U->>LB: Send Message Request
    LB->>API: Route to API Gateway
    API->>AS: Validate Auth Token
    AS-->>API: Auth Success
    API->>MS: Process Message
    MS->>C: Check Cache
    alt Cache Hit
        C-->>MS: Return Cached Data
    else Cache Miss
        MS->>DB: Query Database
        DB-->>MS: Return Data
        MS->>C: Update Cache
    end
    MS-->>API: Message Processed
    API-->>LB: Success Response
    LB-->>U: Message Sent
    
    Note over MS,DB: Handles message persistence
    Note over C: Redis for caching
```

**This code is ready to copy-paste directly into mermaid.live!**

### System Design Document
Comprehensive document including:
- **System Overview**
- **Architecture Components**
- **Database Design**
- **API Design**
- **Scalability Strategy**
- **Reliability & Fault Tolerance**
- **Security Considerations**
- **Monitoring & Observability**
- **Deployment Strategy**
- **Cost Optimization**

## 🏗️ Architecture

```
Frontend (React) → Backend (FastAPI) → aimakerspace → OpenAI API
                                   ↓
                    System Design Knowledge Base (Vector DB)
                                   ↑
                         PDF Files (Auto-indexed)
```

## 🔄 Interview Flow

1. **PDF Indexing** (Startup)
   - Load PDFs from `system_design_pdfs/`
   - Extract text and create chunks
   - Generate embeddings using OpenAI
   - Store in vector database

2. **Question Generation** (Per Question)
   - Search knowledge base for relevant context
   - Use previous answers for follow-up questions
   - Generate contextual, specific questions
   - Follow structured interview template

3. **Final Generation** (After 5 Questions)
   - Analyze all answers and requirements
   - Search knowledge base for architecture patterns
   - Generate production-ready Mermaid diagram
   - Create comprehensive system design document

## 🎨 Features

- **📚 Knowledge-Based Questions:** Uses your PDFs for context
- **🎯 Structured Interview:** 5-question format covering all aspects
- **📈 Progress Tracking:** Visual progress bar
- **🔄 Session Management:** Maintains interview state
- **📋 Copy-Paste Ready:** Direct mermaid.live compatibility
- **🏭 Production-Ready:** Comprehensive system designs
- **🎨 Modern UI:** Clean, professional interface

## 🚀 Advanced Usage

### Custom PDF Knowledge Base
- Add domain-specific architecture guides
- Include company-specific patterns
- Reference industry best practices
- Update knowledge by adding new PDFs and restarting

### Interview Customization
- Modify question templates in `api/app.py`
- Adjust number of questions (currently 5)
- Customize system design document structure
- Fine-tune Mermaid diagram generation

## 🔧 Technical Details

- **Backend:** FastAPI with aimakerspace library
- **Frontend:** React with TypeScript
- **AI:** OpenAI GPT-4o for generation, text-embedding-3-small for indexing
- **Vector DB:** In-memory numpy-based vector store
- **PDF Processing:** PyPDF2 with chunking strategy
- **Diagram Format:** Mermaid sequence diagrams

## 🎪 Example Interview Session

**System:** "Design a chat application like WhatsApp"

**Q1:** Requirements gathering and scale estimation
**Q2:** High-level architecture and component design  
**Q3:** Database schema and data storage strategy
**Q4:** Scalability and performance optimization
**Q5:** Reliability, monitoring, and fault tolerance

**Output:** Complete system design + Mermaid diagram ready for mermaid.live

---

**Ready to conduct your system design interview? Add your PDFs and start designing!** 🚀
