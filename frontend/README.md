# 🤖 AI Maker Space Frontend

Welcome to the **AI Maker Space** frontend! This is a beautiful, modern React chat interface that connects to your FastAPI backend to chat with various OpenAI models.

## ✨ Features

- **Real-time Streaming**: Watch AI responses appear in real-time as they're generated
- **Multiple Models**: Support for GPT-4.1 Mini, GPT-4o, GPT-4o Mini, and GPT-3.5 Turbo
- **Customizable System Messages**: Define the AI's role and behavior for each conversation
- **Responsive Design**: Works perfectly on desktop, tablet, and mobile devices
- **Modern UI**: Beautiful gradient design with smooth animations and transitions
- **Secure API Key Input**: Your OpenAI API key is handled securely

## 🚀 Quick Start

### Prerequisites

- Node.js (version 16 or higher)
- npm or yarn
- Your FastAPI backend running on `http://localhost:8000`

### Installation

1. **Navigate to the frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm start
   ```

4. **Open your browser:**
   The app will automatically open at `http://localhost:3000`

## 🎯 How to Use

1. **Enter your OpenAI API Key** in the settings panel at the top
2. **Choose your preferred model** from the dropdown menu
3. **Customize the system message** to define the AI's role (optional)
4. **Start chatting!** Type your message and press Enter or click the send button
5. **Watch the magic happen** as the AI responds in real-time

## 🔧 Configuration

The frontend is configured to automatically proxy API requests to your FastAPI backend running on port 8000. If you need to change this:

1. Update the `proxy` field in `package.json`
2. Or modify the fetch URL in `src/App.tsx`

## 📱 Responsive Design

The interface automatically adapts to different screen sizes:
- **Desktop**: Full-featured layout with side-by-side settings
- **Tablet**: Optimized layout with stacked settings
- **Mobile**: Compact design perfect for on-the-go chatting

## 🎨 Customization

Want to make it your own? Here are some easy customizations:

- **Colors**: Modify the gradient colors in `src/App.css`
- **Models**: Add or remove model options in `src/App.tsx`
- **Styling**: Update the CSS classes to match your brand

## 🛠️ Development

### Available Scripts

- `npm start` - Runs the app in development mode
- `npm build` - Builds the app for production
- `npm test` - Launches the test runner
- `npm eject` - Ejects from Create React App (one-way operation)

### Project Structure

```
frontend/
├── public/          # Static files
├── src/             # Source code
│   ├── App.tsx      # Main application component
│   ├── App.css      # Application styles
│   ├── index.tsx    # Entry point
│   └── index.css    # Global styles
├── package.json     # Dependencies and scripts
└── tsconfig.json    # TypeScript configuration
```

## 🔒 Security Notes

- Your OpenAI API key is stored only in the browser's memory
- No API keys are sent to any server except OpenAI
- The frontend communicates directly with your FastAPI backend
- Consider using environment variables for production deployments

## 🐛 Troubleshooting

**App won't start?**
- Make sure Node.js is installed and up to date
- Try deleting `node_modules` and running `npm install` again

**Can't connect to the API?**
- Ensure your FastAPI backend is running on port 8000
- Check that CORS is properly configured in your backend
- Verify the proxy setting in `package.json`

**API key not working?**
- Double-check your OpenAI API key
- Ensure you have sufficient credits in your OpenAI account
- Try testing the API key directly with OpenAI's playground

## 🎉 Ready to Chat!

You're all set! Fire up your backend, start the frontend, and start having amazing conversations with AI. The interface is designed to be intuitive and enjoyable to use.

Happy chatting! 🚀