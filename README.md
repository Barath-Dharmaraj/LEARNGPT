# LearnGPT — AI-Powered Learning Management System

Live demo: https://learngpt-lms-barath.netlify.app

## What it does
- Admin uploads study materials (PDF, DOCX, PPTX, TXT)
- Students chat with an AI tutor grounded in uploaded documents
- Auto-generates flashcards and MCQ quizzes from document content
- Role-based access control (Admin / Student)
- Progress and quiz score tracking

## Tech Stack
- **Frontend:** React.js
- **AI:** Groq API (Llama 3.1) via Netlify Functions
- **Document Parsing:** PDF.js, Mammoth.js
- **Deployment:** Netlify (CI/CD from GitHub)
- **Auth:** Secure serverless admin login

## Features
- RAG-style document context sent to AI
- In-browser PDF and DOCX text extraction
- AI-generated flashcards per document
- Difficulty-tiered MCQ quiz generation
- Markdown-rendered AI responses
- Persistent document storage

