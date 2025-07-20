# 🤖 AI Maker Space

Welcome to the AI Maker Space! This is your playground for building awesome AI-powered applications. We've got a slick FastAPI backend that talks to OpenAI's API and a modern frontend to make it all look pretty.

## 🚀 What's Inside

This project is a full-stack AI chat application that lets you interact with GPT models like a developer would. Here's what you'll find:

- **Backend API** (`/api`): A FastAPI service that handles chat streaming with OpenAI
- **Frontend** (`/frontend`): A modern web interface (Next.js) for chatting with AI
- **Jupyter Notebook**: Interactive examples and experiments
- **Vercel Deployment**: Ready to deploy to the cloud!

## 🛠️ Quick Start

### Prerequisites
- Python 3.13+ (we're using the latest and greatest!)
- Node.js (for the frontend)
- An OpenAI API key (get one from [OpenAI](https://platform.openai.com/))

### Backend Setup

1. **Navigate to the API directory:**
```bash
cd api
```

2. **Install Python dependencies:**
```bash
pip install -r requirements.txt
```

3. **Start the FastAPI server:**
```bash
python app.py
```

Your API will be running at `http://localhost:8000` 🎉

### Frontend Setup

1. **Navigate to the frontend directory:**
```bash
cd frontend
```

2. **Install Node.js dependencies:**
```bash
npm install
```

3. **Start the development server:**
```bash
npm run dev
```

Your frontend will be running at `http://localhost:3000` ✨

## 🔧 API Endpoints

### Chat with AI
- **POST** `/api/chat`
- Send messages to GPT models with streaming responses
- Supports custom models and API keys

### Health Check
- **GET** `/api/health`
- Make sure everything is running smoothly

### Interactive Docs
Once your API is running, check out the auto-generated docs:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## 🌐 Deployment

This project is configured for easy deployment on Vercel! The `vercel.json` file handles routing between the frontend and backend automatically.

## 📚 Learn More

- Check out the `Accessing_GPT_4_1_nano_Like_a_Developer.ipynb` notebook for interactive examples
- Read the detailed API documentation in `/api/README.md`
- Got questions? Check out `FAQandCommonIssues.md`

## 🤝 Contributing

Found a bug? Want to add a cool feature? We'd love your help! Feel free to:
- Submit an issue
- Create a pull request
- Add to our FAQ document

## 📄 License

This project is licensed under the MIT License - see the `LICENSE` file for details.

---

Happy coding! 🎉 Let's build something amazing together!
