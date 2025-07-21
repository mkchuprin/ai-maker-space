import React, { useState } from 'react';
import { AuthService, LoginCredentials } from './auth';
import './Login.css';

interface LoginProps {
  onLoginSuccess: () => void;
}

function Login({ onLoginSuccess }: LoginProps) {
  const [credentials, setCredentials] = useState<LoginCredentials>({
    username: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const success = await AuthService.login(credentials);
      if (success) {
        onLoginSuccess();
      } else {
        setError('Invalid username or password');
      }
    } catch (err) {
      setError('Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: keyof LoginCredentials) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setCredentials(prev => ({
      ...prev,
      [field]: e.target.value
    }));
    setError(''); // Clear error when user starts typing
  };

  return (
    <div className="login-container">
      {/* SnackChat Background Logo */}
      <div className="slapchat-logo">SnackChat</div>
      
      <div className="login-card">
        <div className="login-header">
          <h1>🤖 SnackChat</h1>
          <p>Welcome back! Please sign in to continue.</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={credentials.username}
              onChange={handleInputChange('username')}
              placeholder="Enter your username"
              required
              disabled={isLoading}
              className="login-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={credentials.password}
              onChange={handleInputChange('password')}
              placeholder="Enter your password"
              required
              disabled={isLoading}
              className="login-input"
            />
          </div>

          {error && (
            <div className="error-message">
              ❌ {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !credentials.username || !credentials.password}
            className="login-button"
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="demo-credentials">
          <h3>Demo Credentials:</h3>
          <div className="credential-list">
            <div className="credential-item">
              <strong>admin</strong> / <strong>admin123</strong>
            </div>
            <div className="credential-item">
              <strong>user</strong> / <strong>password</strong>
            </div>
            <div className="credential-item">
              <strong>demo</strong> / <strong>demo123</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login; 