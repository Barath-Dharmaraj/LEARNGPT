# LearnGPT — AI-Powered Learning Management System

> **Live Demo:** https://learngpt-lms-barath.netlify.app

An AI-powered study platform where admins upload documents and students chat with them, take quizzes, generate flashcards, and track their progress — all grounded in uploaded content only (no hallucinations).

---

## ✨ Features (15 total)

### 🤖 AI & Learning Core
| Feature | Description |
|---------|-------------|
| **RAG AI Tutor** | Chat with any uploaded document. AI answers ONLY from document content — no outside knowledge |
| **AI Flashcards** | One-click generation of 8 Q&A flashcard pairs from any document |
| **AI Quiz Generator** | 5-question MCQ quizzes at Easy / Medium / Hard difficulty |
| **AI Document Summary** | Instant structured summary (Overview + Key Topics + Important Terms), cached after first generation |
| **Weak Topics Analyzer** | After each quiz, AI identifies exactly which topics you need to review based on wrong answers |

### 📊 Progress & Gamification
| Feature | Description |
|---------|-------------|
| **🔥 Daily Streak** | Tracks consecutive login days. ⚡ → 🔥 (3 days) → 🏆 (7 days) |
| **🏅 Achievements** | 10 unlockable badges with animated toast popup on unlock |
| **🏆 Leaderboard** | Ranked by Overall / Quiz Avg / Questions Asked / Flashcards Mastered |
| **📅 Study Heatmap** | GitHub-style 15-week activity grid on Dashboard and Progress page |
| **📈 Progress Tracking** | Quiz score trend chart, session stats, flashcard mastery |

### 🛠 Productivity Tools
| Feature | Description |
|---------|-------------|
| **⏱ Study Timer** | Floating Pomodoro timer (25-min focus / 5-min break) with SVG ring and push notifications |
| **📝 My Notes** | Private per-document notes with markdown support, search, and Ctrl+S shortcut |
| **💬 Chat History** | AI Tutor conversations persist across sessions (60 messages per doc) |

### 🎨 UI / UX
| Feature | Description |
|---------|-------------|
| **🌓 Dark / Light Mode** | Full theme switching with CSS variables, persists across sessions |
| **🎯 Onboarding Tour** | 8-step guided tour for new students, 6-step for admin. Replay anytime |
| **⚡ Rate Limit UI** | Live API usage bar in sidebar (green → orange → red) with countdown timer |
| **🔔 Push Notifications** | Browser notifications for quiz completion, doc uploads, timer end, flashcard generation |
| **📱 Mobile Responsive** | Bottom navigation bar on mobile, responsive grid layouts |

### 👑 Admin Tools
| Feature | Description |
|---------|-------------|
| **Document Upload** | Upload PDF, DOCX, PPTX, TXT with live processing stages |
| **Analytics Dashboard** | Line chart, bar chart, donut chart for activity breakdown |
| **Quiz Management** | View all student quiz attempts, score distribution, per-doc performance |
| **Student Progress** | Click any student to see their full stats and quiz history |

---

## 🏅 Achievement Badges

| Badge | Title | How to Earn |
|-------|-------|-------------|
| 🎯 | Quiz Starter | Complete your first quiz |
| 💯 | Perfect Score | Score 100% on any quiz |
| 💬 | Curious Mind | Ask 10 AI questions |
| ⚡ | Flash Master | Master 8+ flashcards |
| 📝 | Quiz Regular | Complete 5 quizzes |
| 🔥 | On Fire | Maintain a 3-day streak |
| 🏆 | Week Warrior | Maintain a 7-day streak |
| ⭐ | High Scorer | 80%+ average over 3 quizzes |
| 🎓 | Scholar | Complete 10 quizzes |
| 🗣️ | Chatterbox | Ask 50 AI questions |

---

## 🧰 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React.js (single file, no build-time dependencies added) |
| **AI / LLM** | Groq API — Llama 3.1 8B Instant (free tier) |
| **Document Parsing** | PDF.js (CDN), Mammoth.js (CDN) — loaded on demand |
| **Charts** | Hand-built SVG components — no chart library needed |
| **Storage** | Netlify Blobs (docs + user data) + `localStorage` (notes, chat history, streak, achievements, summaries) |
| **Auth** | Serverless admin login via Netlify Functions + environment variables |
| **Deployment** | Netlify — auto-deploys on every GitHub push |
| **Notifications** | Browser Notification API (free, no backend) |

---

## 📁 Project Structure

```
learngpt/
├── src/
│   └── App.js                  ← Entire frontend (2,268 lines)
├── netlify/
│   └── functions/
│       ├── chat.js             ← Groq AI proxy
│       ├── storage.js          ← Netlify Blobs (docs/users)
│       ├── progress.js         ← Student progress storage
│       └── admin-login.js      ← Secure admin auth
├── public/
│   └── index.html
├── netlify.toml
└── package.json
```

---

## 🚀 Setup & Deployment

### 1. Clone the repo
```bash
git clone https://github.com/Barath-Dharmaraj/LEARNGPT.git
cd LEARNGPT
npm install
```

### 2. Set environment variables in Netlify
Go to **Netlify → Site Settings → Environment Variables** and add:

| Variable | Description |
|----------|-------------|
| `GROQ_API_KEY` | Get free at [console.groq.com](https://console.groq.com) |
| `ADMIN_EMAIL` | Admin login email |
| `ADMIN_PASS` | Admin login password |
| `JSONBIN_KEY` | (optional) JSONBin API key for extra storage |
| `JSONBIN_ID` | (optional) JSONBin bin ID |

### 3. Deploy
```bash
git add .
git commit -m "Deploy LearnGPT"
git push
```
Netlify auto-detects the push and deploys in ~2 minutes.

### 4. Local development
```bash
npm install -g netlify-cli
netlify dev
```

---

## 📖 How It Works

### For Students
1. **Register** with name + email + password
2. Go to **Library** → browse uploaded documents
3. Click **"AI Summary"** on any doc for an instant overview
4. Open **AI Tutor** → ask questions about the doc
5. Go to **Flashcards** → generate and flip cards
6. Take a **Quiz** → get AI-generated MCQs, see weak topics after
7. Check **Progress** → view quiz trend, heatmap, achievements
8. Use the floating **⏱ timer** to study in focused Pomodoro sessions
9. Compete on the **Leaderboard**

### For Admin
1. Log in with admin credentials
2. Go to **Upload** → drag & drop a document
3. Watch the live processing stages (parse → chunk → index)
4. Document is instantly available to all students
5. Check **Analytics** → see usage charts
6. Go to **Quiz Mgmt** → view all student quiz attempts
7. Go to **Students** → click any student to see their progress

### AI Architecture (RAG)
```
User question
     ↓
Document text extracted on upload (PDF.js / Mammoth.js)
     ↓
Full document text sent as system context to Groq API
     ↓
Llama 3.1 answers ONLY from that context
     ↓
Response with [Source: "Document Name"] citation
```

---

## 🔒 Security
- Admin credentials stored as **environment variables** (never in code)
- Student passwords stored in Netlify Blobs (not exposed to client)
- AI is constrained to document context only — cannot access external URLs or run code
- Rate limiting: 15 API calls per minute with visual UI feedback

---

## 📊 What Gets Stored Where

| Data | Storage | Visible To |
|------|---------|------------|
| Documents + text | Netlify Blobs | All users |
| Student accounts | Netlify Blobs | Admin only |
| Quiz progress | Netlify Blobs | Admin + self |
| Chat history | `localStorage` | Self only |
| Notes | `localStorage` | Self only |
| Streak + achievements | `localStorage` | Self only |
| AI summaries (cached) | `localStorage` | Self only |
| Theme preference | `localStorage` | Self only |

---

## 🗺 Roadmap / Planned Features
- [ ] Spaced repetition for flashcards
- [ ] Study streak leaderboard
- [ ] Bulk document upload
- [ ] Admin announcement banner
- [ ] Custom quiz builder (admin-written questions)
- [ ] PDF inline viewer (side-by-side with chat)
- [ ] Challenge a friend (shared quiz links)

---

## 👤 Author
**Barath Dharmaraj**
- GitHub: [@Barath-Dharmaraj](https://github.com/Barath-Dharmaraj)
- Live App: [learngpt-lms-barath.netlify.app](https://learngpt-lms-barath.netlify.app)

