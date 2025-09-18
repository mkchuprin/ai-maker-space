import React, { useState, useRef, useEffect } from 'react';
import './App.css';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface UploadedPDF {
  pdf_id: string;
  filename: string;
  chunk_count: number;
}

interface PDFUploadResponse {
  pdf_id: string;
  filename: string;
  message: string;
  chunk_count: number;
}

interface InterviewResponse {
  session_id: string;
  question?: string;
  is_complete: boolean;
  mermaid_diagram?: string;
  system_design?: string;
  progress: number;
}

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [developerMessage, setDeveloperMessage] = useState('You are a helpful AI assistant.');
  const [model, setModel] = useState('gpt-4.1-mini');
  const [uploadedPDFs, setUploadedPDFs] = useState<UploadedPDF[]>([]);
  const [selectedPDF, setSelectedPDF] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [chatMode, setChatMode] = useState<'general' | 'pdf' | 'interview'>('interview');
  // Interview state
  const [interviewSession, setInterviewSession] = useState<string>('');
  const [systemRequirements, setSystemRequirements] = useState('');
  const [currentQuestion, setCurrentQuestion] = useState<string>('');
  const [interviewProgress, setInterviewProgress] = useState<number>(0);
  const [isInterviewComplete, setIsInterviewComplete] = useState<boolean>(false);
  const [mermaidDiagram, setMermaidDiagram] = useState<string>('');
  const [systemDesign, setSystemDesign] = useState<string>('');
  const [interviewStarted, setInterviewStarted] = useState<boolean>(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const assistantMessageRef = useRef<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load uploaded PDFs on component mount
  useEffect(() => {
    loadUploadedPDFs();
  }, []);

  const loadUploadedPDFs = async () => {
    try {
      const response = await fetch('/api/pdfs');
      if (response.ok) {
        const data = await response.json();
        setUploadedPDFs(data.pdfs);
      }
    } catch (error) {
      console.error('Error loading PDFs:', error);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !apiKey.trim()) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', apiKey);

    try {
      const response = await fetch('/api/upload-pdf', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: PDFUploadResponse = await response.json();
      
      // Add to uploaded PDFs list
      const newPDF: UploadedPDF = {
        pdf_id: result.pdf_id,
        filename: result.filename,
        chunk_count: result.chunk_count
      };
      
      setUploadedPDFs(prev => [...prev, newPDF]);
      setSelectedPDF(result.pdf_id);
      setChatMode('pdf');
      
      // Add success message to chat
      const successMessage: Message = {
        role: 'assistant',
        content: `📄 PDF "${result.filename}" uploaded successfully! Created ${result.chunk_count} text chunks. You can now ask questions about this document.`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, successMessage]);

    } catch (error) {
      console.error('Error uploading PDF:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: `❌ Error uploading PDF: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const startInterview = async () => {
    if (!systemRequirements.trim() || !apiKey.trim()) {
      alert('Please enter system requirements and API key');
      return;
    }

    setIsLoading(true);
    const sessionId = `interview_${Date.now()}`;
    setInterviewSession(sessionId);

    try {
      const response = await fetch('/api/interview/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionId,
          system_requirements: systemRequirements,
          api_key: apiKey
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: InterviewResponse = await response.json();
      setCurrentQuestion(result.question || '');
      setInterviewProgress(result.progress);
      setInterviewStarted(true);

      // Add first question to messages
      const questionMessage: Message = {
        role: 'assistant',
        content: result.question || '',
        timestamp: new Date()
      };
      setMessages([questionMessage]);

    } catch (error) {
      console.error('Error starting interview:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: `Error starting interview: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date()
      };
      setMessages([errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const submitInterviewAnswer = async (answer: string) => {
    if (!interviewSession || !answer.trim()) return;

    setIsLoading(true);

    try {
      const response = await fetch('/api/interview/answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: interviewSession,
          user_answer: answer,
          api_key: apiKey
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: InterviewResponse = await response.json();
      setInterviewProgress(result.progress);

      if (result.is_complete) {
        setIsInterviewComplete(true);
        setMermaidDiagram(result.mermaid_diagram || '');
        setSystemDesign(result.system_design || '');

        // Add final results to messages
        const completionMessage: Message = {
          role: 'assistant',
          content: `🎉 Interview Complete! Here's your system design:\n\n**Mermaid Diagram:**\n\`\`\`\n${result.mermaid_diagram}\n\`\`\`\n\n**System Design:**\n${result.system_design}`,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, completionMessage]);
      } else {
        setCurrentQuestion(result.question || '');

        // Add next question to messages
        const questionMessage: Message = {
          role: 'assistant',
          content: result.question || '',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, questionMessage]);
      }

    } catch (error) {
      console.error('Error submitting answer:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !apiKey.trim()) return;

    // Handle interview mode
    if (chatMode === 'interview') {
      if (!interviewStarted) {
        alert('Please start the interview first');
        return;
      }
      
      const userMessage = inputMessage.trim();
      setInputMessage('');
      
      // Add user message to chat
      const newUserMessage: Message = {
        role: 'user',
        content: userMessage,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, newUserMessage]);
      
      // Submit answer to interview system
      await submitInterviewAnswer(userMessage);
      return;
    }

    // Check if PDF mode is selected but no PDF is chosen
    if (chatMode === 'pdf' && !selectedPDF) {
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Please upload a PDF first or switch to general chat mode.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      return;
    }

    const userMessage = inputMessage.trim();
    setInputMessage('');
    
    // Add user message to chat
    const newUserMessage: Message = {
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, newUserMessage]);
    setIsLoading(true);

    try {
      let apiUrl: string;
      let requestBody: any;
      
      if (chatMode === 'pdf') {
        // PDF RAG chat
        apiUrl = '/api/pdf-chat';
        requestBody = {
          user_message: userMessage,
          pdf_id: selectedPDF,
          model: model,
          api_key: apiKey
        };
      } else {
        // General chat
        apiUrl = '/api/chat';
        requestBody = {
          developer_message: developerMessage,
          user_message: userMessage,
          model: model,
          api_key: apiKey
        };
      }
      
      console.log('Sending request with:', {
        ...requestBody,
        api_key: apiKey ? `${apiKey.substring(0, 10)}...` : 'empty'
      });
        
      const response = await fetch(apiUrl, {
        method: 'POST',
        mode: 'cors',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/plain',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      // Reset the assistant message ref
      assistantMessageRef.current = '';
      
      const newAssistantMessage: Message = {
        role: 'assistant',
        content: '',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, newAssistantMessage]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        assistantMessageRef.current += chunk;
        
        setMessages(prev => 
          prev.map((msg, index) => 
            index === prev.length - 1 && msg.role === 'assistant'
              ? { ...msg, content: assistantMessageRef.current }
              : msg
          )
        );
      }

    } catch (error) {
      console.error('Error:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'An unknown error occurred'}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  return (
    <div className="App">
      {/* SnackChat Background Logo */}
      <div className="slapchat-logo">SnackChat</div>
      
      <div className="chat-container">
        <header className="chat-header">
          <div className="header-content">
            <h1>🤖 SnackChat</h1>
            <p>AI Maker Space - Chat with AI models powered by OpenAI</p>
          </div>
        </header>

        <div className="settings-panel">
          <div className="setting-group">
            <label htmlFor="apiKey">OpenAI API Key:</label>
            <input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your OpenAI API key"
              className="api-key-input"
            />
          </div>
          
          <div className="setting-group">
            <label htmlFor="model">Model:</label>
            <select
              id="model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="model-select"
            >
              <option value="gpt-4.1-mini">GPT-4.1 Mini</option>
              <option value="gpt-4o">GPT-4o</option>
              <option value="gpt-4o-mini">GPT-4o Mini</option>
              <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
            </select>
          </div>

          <div className="setting-group">
            <label htmlFor="chatMode">Mode:</label>
            <select
              id="chatMode"
              value={chatMode}
              onChange={(e) => setChatMode(e.target.value as 'general' | 'pdf' | 'interview')}
              className="model-select"
            >
              <option value="interview">System Design Interview</option>
              <option value="general">General Chat</option>
              <option value="pdf">PDF RAG Chat</option>
            </select>
          </div>

          {chatMode === 'general' && (
            <div className="setting-group">
              <label htmlFor="developerMessage">System Message:</label>
              <textarea
                id="developerMessage"
                value={developerMessage}
                onChange={(e) => setDeveloperMessage(e.target.value)}
                placeholder="Define the AI's role and behavior"
                className="developer-message-input"
                rows={3}
              />
            </div>
          )}

          {chatMode === 'interview' && (
            <div className="setting-group">
              <label htmlFor="systemRequirements">System to Design:</label>
              <textarea
                id="systemRequirements"
                value={systemRequirements}
                onChange={(e) => setSystemRequirements(e.target.value)}
                placeholder="e.g., Design a chat application like WhatsApp"
                className="developer-message-input"
                rows={2}
                disabled={interviewStarted}
              />
            </div>
          )}

          {chatMode === 'interview' && !interviewStarted && (
            <div className="setting-group">
              <button
                type="button"
                onClick={startInterview}
                disabled={!apiKey.trim() || !systemRequirements.trim() || isLoading}
                className="interview-start-button"
              >
                {isLoading ? '⏳ Starting Interview...' : '🎯 Start System Design Interview'}
              </button>
            </div>
          )}

          {chatMode === 'interview' && interviewStarted && (
            <div className="setting-group">
              <div className="interview-progress">
                <label>Progress: {interviewProgress}%</label>
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${interviewProgress}%` }}
                  ></div>
                </div>
              </div>
            </div>
          )}

          {chatMode === 'pdf' && (
            <div className="setting-group">
              <label htmlFor="pdfUpload">Upload PDF:</label>
              <div className="pdf-upload-container">
                <input
                  ref={fileInputRef}
                  id="pdfUpload"
                  type="file"
                  accept=".pdf"
                  onChange={handleFileUpload}
                  className="pdf-file-input"
                  disabled={!apiKey.trim() || isUploading}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!apiKey.trim() || isUploading}
                  className="pdf-upload-button"
                >
                  {isUploading ? '⏳ Uploading...' : '📄 Upload PDF'}
                </button>
              </div>
            </div>
          )}

          {chatMode === 'pdf' && uploadedPDFs.length > 0 && (
            <div className="setting-group">
              <label htmlFor="selectedPDF">Select PDF:</label>
              <select
                id="selectedPDF"
                value={selectedPDF}
                onChange={(e) => setSelectedPDF(e.target.value)}
                className="model-select"
              >
                <option value="">Choose a PDF...</option>
                {uploadedPDFs.map((pdf) => (
                  <option key={pdf.pdf_id} value={pdf.pdf_id}>
                    {pdf.filename} ({pdf.chunk_count} chunks)
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="messages-container">
          {messages.length === 0 && !isLoading && (
            <div className="empty-state">
              <div className="empty-icon">
                {chatMode === 'pdf' ? '📄' : chatMode === 'interview' ? '🎯' : '💬'}
              </div>
              <h3>
                {chatMode === 'pdf' 
                  ? 'Upload a PDF to get started!' 
                  : chatMode === 'interview' 
                    ? 'System Design Interview' 
                    : 'Start a conversation!'
                }
              </h3>
              <p>
                {chatMode === 'pdf' 
                  ? 'Upload a PDF document and ask questions about its content using AI-powered RAG.'
                  : chatMode === 'interview'
                    ? 'Enter the system you want to design and start your technical interview. The AI will guide you through 5 questions and generate a complete system design with Mermaid diagrams.'
                    : 'Enter your message below to begin chatting with the AI.'
                }
              </p>
            </div>
          )}
          
          {messages.map((message, index) => (
            <div
              key={index}
              className={`message ${message.role === 'user' ? 'user-message' : 'assistant-message'}`}
            >
              <div className="message-content">
                <div className="message-role">
                  {message.role === 'user' ? '👤 You' : '🤖 AI'}
                </div>
                <div className="message-text">
                  {message.content}
                </div>
                <div className="message-timestamp">
                  {message.timestamp.toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="message assistant-message">
              <div className="message-content">
                <div className="message-role">🤖 AI</div>
                <div className="message-text">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSubmit} className="input-form">
          <div className="input-container">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={
                chatMode === 'pdf' 
                  ? (selectedPDF ? "Ask a question about your PDF..." : "Upload a PDF first...")
                  : chatMode === 'interview'
                    ? (interviewStarted ? "Enter your answer to the interview question..." : "Start the interview first...")
                    : "Type your message here..."
              }
              disabled={
                isLoading || 
                !apiKey.trim() || 
                (chatMode === 'pdf' && !selectedPDF) ||
                (chatMode === 'interview' && !interviewStarted)
              }
              className="message-input"
            />
            <button
              type="submit"
              disabled={
                isLoading || 
                !inputMessage.trim() || 
                !apiKey.trim() || 
                (chatMode === 'pdf' && !selectedPDF) ||
                (chatMode === 'interview' && !interviewStarted)
              }
              className="send-button"
            >
              {isLoading ? '⏳' : '📤'}
            </button>
          </div>
        </form>

        <div className="chat-actions">
          <button onClick={clearChat} className="clear-button">
            🗑️ Clear Chat
          </button>
        </div>
      </div>
    </div>
  );
}

export default App; 