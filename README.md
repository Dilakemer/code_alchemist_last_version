# CodeAlchemist - Multi-Model AI Code Assistant

![CodeAlchemist Banner](https://via.placeholder.com/1200x300/1a1a2e/16213e?text=CodeAlchemist)

## 🚀 Overview

CodeAlchemist is a professional, multi-model AI-powered code assistant that combines the strengths of Google Gemini, Anthropic Claude, and OpenAI GPT models to provide intelligent code analysis, generation, and assistance.

## ✨ Features

- **Multi-Model Intelligence**: Switch between Gemini, Claude, and GPT models
- **Code Analysis**: Intelligent code review and optimization suggestions
- **Real-time Chat**: Interactive code assistance with context awareness
- **Image Generation**: DALL-E 3 integration for visual content
- **User Management**: Secure authentication with JWT
- **Cloud Database**: PostgreSQL (Supabase) for data persistence
- **Dockerized**: Fully containerized for consistent deployment

## 🏗️ Architecture

- **Frontend**: React 18 + Vite
- **Backend**: Flask (Python)
- **Database**: PostgreSQL (Supabase)
- **AI Models**: Gemini 3.0/2.5, Claude 4.5 (Sonnet & Opus), GPT-4o, Gemma 4
- **Deployment**: Docker + Render.com

## 📦 Installation

### Prerequisites

- Docker & Docker Compose
- Python 3.9+
- Node.js 18+

### Quick Start

1. **Clone the repository**
```bash
git clone <your-repo-url>
cd code_alchemist
```

2. **Set up environment variables**
```bash
cp .env.example .env
# Edit .env and add your API keys
```

3. **Run with Docker**
```bash
docker-compose up --build
```

4. **Access the application**
- Frontend: http://localhost:80
- Backend API: http://localhost:5000

## 🔧 Configuration

Required environment variables in `.env`:

```bash
# AI Model APIs
GEMINI_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here

# Database
DATABASE_URL=postgresql://user:pass@host:5432/db

# Security
SECRET_KEY=your_secret_key
JWT_SECRET_KEY=your_jwt_secret
```

## 🌐 Deployment

This project is configured for deployment on Render.com with Docker support.

### Deploy to Render

1. Push your code to GitHub
2. Create a new Web Service on Render
3. Connect your GitHub repository
4. Configure environment variables
5. Deploy!

## 📊 Tech Stack

| Category | Technology |
|----------|-----------|
| Frontend | React, Vite, TailwindCSS |
| Backend | Flask, SQLAlchemy, Gunicorn |
| Database | PostgreSQL (Supabase) |
| AI Models | Gemini 3.0/2.5, Claude 4.5, GPT-4o, Gemma 4, DALL-E 3 |
| DevOps | Docker, Docker Compose |
| Hosting | Render.com |

## 🎓 Academic Context

This project was developed as part of an academic study on multi-model AI integration and demonstrates:
- Modern web architecture patterns
- Cloud-native design principles
- AI model orchestration
- Secure authentication mechanisms

## 📝 License

MIT License - See LICENSE file for details

## 👤 Author

Developed by Dilakemer

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

**Note**: This is an academic project. API keys and sensitive data should never be committed to version control.
