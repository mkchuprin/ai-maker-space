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
  sequence_diagram?: string;
  high_level_design?: string;
  database_schema?: string;
  api_design?: string;
  deployment_diagram?: string;
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
  const [interviewProgress, setInterviewProgress] = useState<number>(0);
  const [isInterviewComplete, setIsInterviewComplete] = useState<boolean>(false);
  const [interviewStarted, setInterviewStarted] = useState<boolean>(false);
  // Output preferences
  const [outputPreferences, setOutputPreferences] = useState({
    sequenceDiagram: true,
    highLevelDesign: true,
    databaseSchema: false,
    apiDesign: false,
    deploymentDiagram: false,
    systemDesignDoc: true
  });
  // Store all generated outputs for downloading
  const [generatedOutputs, setGeneratedOutputs] = useState<{
    sequence_diagram?: string;
    high_level_design?: string;
    database_schema?: string;
    api_design?: string;
    deployment_diagram?: string;
    system_design?: string;
  }>({});
  
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

  const handleOutputPreferenceChange = (preference: string) => {
    setOutputPreferences(prev => ({
      ...prev,
      [preference]: !prev[preference as keyof typeof prev]
    }));
  };

  const downloadFile = (content: string, filename: string, contentType: string = 'text/plain') => {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadMermaidFile = (content: string, filename: string) => {
    // For Mermaid files, we want plain text with .mmd extension for mermaid.live
    downloadFile(content, `${filename}.mmd`, 'text/plain');
  };

  const downloadMarkdownFile = (content: string, filename: string) => {
    downloadFile(content, `${filename}.md`, 'text/markdown');
  };

  const downloadAllOutputs = () => {
    const systemName = systemRequirements.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    const timestamp = new Date().toISOString().split('T')[0];
    
    Object.entries(generatedOutputs).forEach(([key, content]) => {
      if (!content) return;
      
      let filename: string;
      let isMermaid = false;
      
      switch (key) {
        case 'sequence_diagram':
          filename = `${systemName}_sequence_diagram_${timestamp}`;
          isMermaid = true;
          break;
        case 'high_level_design':
          filename = `${systemName}_architecture_diagram_${timestamp}`;
          isMermaid = true;
          break;
        case 'database_schema':
          filename = `${systemName}_database_schema_${timestamp}`;
          isMermaid = true;
          break;
        case 'deployment_diagram':
          filename = `${systemName}_deployment_diagram_${timestamp}`;
          isMermaid = true;
          break;
        case 'api_design':
          filename = `${systemName}_api_design_${timestamp}`;
          break;
        case 'system_design':
          filename = `${systemName}_system_design_${timestamp}`;
          break;
        default:
          filename = `${systemName}_${key}_${timestamp}`;
      }
      
      if (isMermaid) {
        downloadMermaidFile(content, filename);
      } else {
        // Wrap non-mermaid content in markdown format
        const markdownContent = key === 'system_design' 
          ? content 
          : `# ${filename.replace(/_/g, ' ').toUpperCase()}\n\n${content}`;
        downloadMarkdownFile(markdownContent, filename);
      }
    });
  };

  const downloadSingleOutput = (key: string, content: string) => {
    const systemName = systemRequirements.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    const timestamp = new Date().toISOString().split('T')[0];
    
    let filename: string;
    let isMermaid = false;
    
    switch (key) {
      case 'sequence_diagram':
        filename = `${systemName}_sequence_diagram_${timestamp}`;
        isMermaid = true;
        break;
      case 'high_level_design':
        filename = `${systemName}_architecture_diagram_${timestamp}`;
        isMermaid = true;
        break;
      case 'database_schema':
        filename = `${systemName}_database_schema_${timestamp}`;
        isMermaid = true;
        break;
      case 'deployment_diagram':
        filename = `${systemName}_deployment_diagram_${timestamp}`;
        isMermaid = true;
        break;
      case 'api_design':
        filename = `${systemName}_api_design_${timestamp}`;
        break;
      case 'system_design':
        filename = `${systemName}_system_design_${timestamp}`;
        break;
      default:
        filename = `${systemName}_${key}_${timestamp}`;
    }
    
    if (isMermaid) {
      downloadMermaidFile(content, filename);
    } else {
      const markdownContent = key === 'system_design' 
        ? content 
        : `# ${filename.replace(/_/g, ' ').toUpperCase()}\n\n${content}`;
      downloadMarkdownFile(markdownContent, filename);
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
          api_key: apiKey,
          output_preferences: outputPreferences
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

        // Store all generated outputs for downloading
        setGeneratedOutputs({
          sequence_diagram: result.sequence_diagram,
          high_level_design: result.high_level_design,
          database_schema: result.database_schema,
          api_design: result.api_design,
          deployment_diagram: result.deployment_diagram,
          system_design: result.system_design
        });

        // Build completion message with download instructions
        let completionContent = '🎉 Design Complete! Your architecture files are ready for download.\n\n';
        completionContent += '📁 **Available Downloads:**\n';
        
        if (result.sequence_diagram) {
          completionContent += '• 📊 Sequence Diagram (.mmd for mermaid.live)\n';
        }
        if (result.high_level_design) {
          completionContent += '• 🏗️ High-Level Architecture (.mmd for mermaid.live)\n';
        }
        if (result.database_schema) {
          completionContent += '• 🗄️ Database Schema (.mmd for mermaid.live)\n';
        }
        if (result.api_design) {
          completionContent += '• 🔌 API Design (.md markdown file)\n';
        }
        if (result.deployment_diagram) {
          completionContent += '• 🚀 Deployment Architecture (.mmd for mermaid.live)\n';
        }
        if (result.system_design) {
          completionContent += '• 📋 System Design Document (.md markdown file)\n';
        }

        completionContent += '\n💡 **Tip:** .mmd files can be directly opened in mermaid.live, .md files can be viewed in any markdown editor!';

        const completionMessage: Message = {
          role: 'assistant',
          content: completionContent,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, completionMessage]);
      } else {

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
        alert('Please start the architecture designer first');
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
            <h1>🏗️ Architecture Studio</h1>
            <p>Design systems like a pro with AI guidance</p>
          </div>
        </header>

        <div className="main-content">
          <div className="sidebar">
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
                  <option value="interview">Architecture Designer</option>
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
              <label>What outputs do you want? (Select all that apply):</label>
              <div className="output-preferences">
                <div className="checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={outputPreferences.sequenceDiagram}
                      onChange={() => handleOutputPreferenceChange('sequenceDiagram')}
                    />
                    📊 Sequence Diagram (Mermaid)
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={outputPreferences.highLevelDesign}
                      onChange={() => handleOutputPreferenceChange('highLevelDesign')}
                    />
                    🏗️ High-Level Architecture Diagram
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={outputPreferences.databaseSchema}
                      onChange={() => handleOutputPreferenceChange('databaseSchema')}
                    />
                    🗄️ Database Schema Diagram
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={outputPreferences.apiDesign}
                      onChange={() => handleOutputPreferenceChange('apiDesign')}
                    />
                    🔌 API Design & Endpoints
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={outputPreferences.deploymentDiagram}
                      onChange={() => handleOutputPreferenceChange('deploymentDiagram')}
                    />
                    🚀 Deployment Architecture
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={outputPreferences.systemDesignDoc}
                      onChange={() => handleOutputPreferenceChange('systemDesignDoc')}
                    />
                    📋 Complete System Design Document
                  </label>
                </div>
              </div>
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
                {isLoading ? '⏳ Starting Designer...' : '🎯 Start Architecture Design'}
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

        {/* Download Section - Show after interview completion */}
        {chatMode === 'interview' && isInterviewComplete && Object.keys(generatedOutputs).some(key => generatedOutputs[key as keyof typeof generatedOutputs]) && (
          <div className="download-section">
            <h3>📁 Download Your Files</h3>
            <div className="download-buttons">
              <button
                onClick={downloadAllOutputs}
                className="download-all-button"
              >
                📦 Download All Files
              </button>
              <div className="individual-downloads">
                {generatedOutputs.sequence_diagram && (
                  <button
                    onClick={() => downloadSingleOutput('sequence_diagram', generatedOutputs.sequence_diagram!)}
                    className="download-single-button"
                  >
                    📊 Sequence.mmd
                  </button>
                )}
                {generatedOutputs.high_level_design && (
                  <button
                    onClick={() => downloadSingleOutput('high_level_design', generatedOutputs.high_level_design!)}
                    className="download-single-button"
                  >
                    🏗️ Architecture.mmd
                  </button>
                )}
                {generatedOutputs.database_schema && (
                  <button
                    onClick={() => downloadSingleOutput('database_schema', generatedOutputs.database_schema!)}
                    className="download-single-button"
                  >
                    🗄️ Database.mmd
                  </button>
                )}
                {generatedOutputs.api_design && (
                  <button
                    onClick={() => downloadSingleOutput('api_design', generatedOutputs.api_design!)}
                    className="download-single-button"
                  >
                    🔌 API.md
                  </button>
                )}
                {generatedOutputs.deployment_diagram && (
                  <button
                    onClick={() => downloadSingleOutput('deployment_diagram', generatedOutputs.deployment_diagram!)}
                    className="download-single-button"
                  >
                    🚀 Deployment.mmd
                  </button>
                )}
                {generatedOutputs.system_design && (
                  <button
                    onClick={() => downloadSingleOutput('system_design', generatedOutputs.system_design!)}
                    className="download-single-button"
                  >
                    📋 SystemDesign.md
                  </button>
                )}
              </div>
            </div>
            <p className="download-tip">
              💡 <strong>Tip:</strong> .mmd files open directly in mermaid.live, .md files work with any markdown editor!
            </p>
          </div>
        )}
          </div>

          <div className="chat-section">
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
                        ? 'Architecture Designer' 
                        : 'Start a conversation!'
                    }
                  </h3>
                  <p>
                    {!apiKey.trim() 
                      ? '🔑 Please enter your OpenAI API key above to get started.'
                      : chatMode === 'pdf'
                        ? 'Upload a PDF document and ask questions about its content using AI-powered RAG.'
                        : chatMode === 'interview'
                          ? 'Enter the system you want to design and let AI guide you through 5 quick questions. Get professional diagrams and documentation instantly.'
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
              
              {isLoading && apiKey.trim() && (
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
                    ? (interviewStarted ? "Choose your answer (A, B, C, or D)..." : "Start the designer first...")
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
      </div>
    </div>
  );
}

export default App; 