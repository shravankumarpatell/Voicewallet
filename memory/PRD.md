# VoiceWallet - AI Voice Expense Tracker

## Overview
A voice-powered expense tracking mobile app with a Jarvis-style AI chatbot for financial management. Users speak about their transactions and AI automatically extracts and categorizes them.

## Tech Stack
- **Frontend**: Expo React Native (SDK 54) with Expo Router
- **Backend**: FastAPI + MongoDB
- **AI**: OpenAI GPT-5.2 (via Emergent LLM Key) for chatbot & transaction extraction
- **STT**: OpenAI Whisper (via Emergent LLM Key) for voice-to-text
- **Auth**: Emergent Google OAuth
- **Audio**: expo-audio for recording

## Features
1. **Mobile OTP Login** (Primary) - Mock OTP shown on screen (works on Expo Go, Android & iOS)
2. **Google OAuth Login** (Web only) - Secure authentication via Emergent Google Auth
3. **Voice Input** - Record voice → AI extracts transactions with category, amount, date, description
3. **Dashboard** - Balance overview, income/expense cards, category breakdown, recent transactions
4. **Transaction CRUD** - Add, edit, delete transactions. Select any past date for missed entries
5. **Jarvis AI Chatbot** - Context-aware financial assistant that knows user's spending data
6. **Category Auto-Assignment** - AI categorizes transactions (Food, Transport, Shopping, etc.)
7. **Dark/Light Mode** - Toggle with persistence via AsyncStorage
8. **Monthly Income Setting** - Set income for balance calculations

## API Endpoints
- `POST /api/auth/session` - Exchange Google auth session
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout
- `PUT /api/user/income` - Update monthly income
- `GET /api/transactions` - List transactions (month/year filter)
- `POST /api/transactions` - Create transaction
- `PUT /api/transactions/{tid}` - Update transaction
- `DELETE /api/transactions/{tid}` - Delete transaction
- `GET /api/dashboard` - Dashboard stats
- `POST /api/voice/transcribe` - Transcribe audio only
- `POST /api/voice/process` - Transcribe + extract transactions
- `POST /api/chat` - Chat with Jarvis AI
- `GET /api/chat/history` - Get chat history

## Currency
- INR (₹) only

## Navigation
- Tab-based: Dashboard, Transactions, Jarvis (Chat), Profile
