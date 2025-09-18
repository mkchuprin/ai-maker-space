import React, { useState, useRef, useEffect } from 'react';
import './App.css';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface InterviewResponse {
  question?: string;
  progress: number;
  is_complete: boolean;
  sequence_diagram?: string;
  high_level_design?: string;
  database_schema?: string;
  api_design?: string;
  deployment_diagram?: string;
  system_design?: string;
}

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gpt-4o');
  const [developerMessage, setDeveloperMessage] = useState('You are a helpful AI assistant.');
  const [isLoading, setIsLoading] = useState(false);
  
  // PDF state
  const [uploadedPDFs, setUploadedPDFs] = useState<any[]>([]);
  const [selectedPDF, setSelectedPDF] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  
  // Chat mode
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
  
  // Store generated outputs for downloading
  const [generatedOutputs, setGeneratedOutputs] = useState<{
    sequence_diagram?: string;
    high_level_design?: string;
    database_schema?: string;
    api_design?: string;
    deployment_diagram?: string;
    system_design?: string;
  }>({});
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
    downloadFile(content, `${filename}.mmd`, 'text/plain');
  };

  const downloadMarkdownFile = (content: string, filename: string) => {
    downloadFile(content, `${filename}.md`, 'text/markdown');
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

  const downloadAllOutputs = () => {
    Object.entries(generatedOutputs).forEach(([key, content]) => {
      if (content) {
        downloadSingleOutput(key, content);
      }
    });
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
          model: model,
          output_preferences: outputPreferences
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: InterviewResponse = await response.json();
      setInterviewProgress(result.progress);
      setInterviewStarted(true);

      const questionMessage: Message = {
        role: 'assistant',
        content: result.question || 'Let\'s start the interview!',
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
      
      const userMsg: Message = {
        role: 'user',
        content: userMessage,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, userMsg]);

      // Submit answer to interview system
      await submitInterviewAnswer(userMessage);
      return;
    }

    // Handle other chat modes (general, pdf)
    const userMessage = inputMessage.trim();
    setInputMessage('');
    
    const userMsg: Message = {
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const endpoint = chatMode === 'pdf' ? '/api/pdf-chat' : '/api/chat';
      const requestBody = chatMode === 'pdf' 
        ? {
            message: userMessage,
            pdf_id: selectedPDF,
            api_key: apiKey,
            model: model
          }
        : {
            message: userMessage,
            developer_message: developerMessage,
            api_key: apiKey,
            model: model
          };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      const assistantMsg: Message = {
        role: 'assistant',
        content: data.response,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMsg]);

    } catch (error) {
      console.error('Error:', error);
      const errorMsg: Message = {
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Something went wrong'}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
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

      const result = await response.json();
      setUploadedPDFs(prev => [...prev, result]);
      setSelectedPDF(result.id);

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error uploading PDF:', error);
      alert(`Error uploading PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="App">
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
              <>
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

                {!interviewStarted && (
                  <div className="setting-group">
                    <label>What outputs do you want?</label>
                    <div className="output-preferences">
                      <div className="checkbox-group">
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={outputPreferences.sequenceDiagram}
                            onChange={() => handleOutputPreferenceChange('sequenceDiagram')}
                          />
                          📊 Sequence Diagram
                        </label>
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={outputPreferences.highLevelDesign}
                            onChange={() => handleOutputPreferenceChange('highLevelDesign')}
                          />
                          🏗️ Architecture Diagram
                        </label>
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={outputPreferences.databaseSchema}
                            onChange={() => handleOutputPreferenceChange('databaseSchema')}
                          />
                          🗄️ Database Schema
                        </label>
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={outputPreferences.apiDesign}
                            onChange={() => handleOutputPreferenceChange('apiDesign')}
                          />
                          🔌 API Design
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
                          📋 System Design Document
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {!interviewStarted && (
                  <button
                    onClick={startInterview}
                    disabled={!apiKey.trim() || !systemRequirements.trim() || isLoading}
                    className="interview-start-button"
                  >
                    {isLoading ? '⏳ Starting Designer...' : '🎯 Start Architecture Design'}
                  </button>
                )}

                {interviewStarted && (
                  <div className="interview-progress">
                    <label>Progress: {interviewProgress}%</label>
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ width: `${interviewProgress}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </>
            )}

            {chatMode === 'pdf' && (
              <>
                <div className="setting-group">
                  <label>Upload PDF:</label>
                  <div className="pdf-upload-container">
                    <input
                      ref={fileInputRef}
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

                {uploadedPDFs.length > 0 && (
                  <div className="setting-group">
                    <label htmlFor="selectedPDF">Select PDF:</label>
                    <select
                      id="selectedPDF"
                      value={selectedPDF}
                      onChange={(e) => setSelectedPDF(e.target.value)}
                      className="model-select"
                    >
                      <option value="">Select a PDF...</option>
                      {uploadedPDFs.map((pdf) => (
                        <option key={pdf.id} value={pdf.id}>
                          {pdf.filename}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="chat-section">
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
                      ? (uploadedPDFs.length === 0 ? "Upload a PDF first..." : selectedPDF ? "Ask about the PDF..." : "Select a PDF first...")
                      : chatMode === 'interview'
                        ? (interviewStarted ? "Choose your answer (A, B, C, or D)..." : "Start the designer first...")
                        : "Type your message..."
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