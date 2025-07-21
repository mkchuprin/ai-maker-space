import React, { useState, useRef, useEffect } from 'react';
import './App.css';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [developerMessage, setDeveloperMessage] = useState('You are a helpful AI assistant.');
  const [model, setModel] = useState('gpt-4.1-mini');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !apiKey.trim()) return;

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
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          developer_message: developerMessage,
          user_message: userMessage,
          model: model,
          api_key: apiKey
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      let assistantMessage = '';
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
        assistantMessage += chunk;
        
        setMessages(prev => 
          prev.map((msg, index) => 
            index === prev.length - 1 && msg.role === 'assistant'
              ? { ...msg, content: assistantMessage }
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
        </div>

        <div className="messages-container">
          {messages.length === 0 && !isLoading && (
            <div className="empty-state">
              <div className="empty-icon">💬</div>
              <h3>Start a conversation!</h3>
              <p>Enter your message below to begin chatting with the AI.</p>
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
              placeholder="Type your message here..."
              disabled={isLoading || !apiKey.trim()}
              className="message-input"
            />
            <button
              type="submit"
              disabled={isLoading || !inputMessage.trim() || !apiKey.trim()}
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