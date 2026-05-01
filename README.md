# Smart Campus Solution

This repository contains a full-stack smart campus project.

## Structure

- `backend/` - Node.js + Express + MongoDB API server
- `frontend/` - React.js application
- `.env` - Global environment variables
- `.gitignore` - Ignored files for Git
- `package.json` - Root scripts to start both backend and frontend together

## Scripts

- `npm run dev` - Start both backend and frontend concurrently
- `npm run start:backend` - Start backend only
- `npm run start:frontend` - Start frontend only

## Setup

1. Install dependencies at the project root:
   ```bash
   npm install
   ```
2. Install backend and frontend dependencies separately:
   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```
3. Add your MongoDB connection string to `.env`.
4. Start the app:
   ```bash
   npm run dev
   ```
