# Virtual Assistant

A focused React and Express virtual assistant project with a simple user flow:

1. Login or sign up on the first screen.
2. Choose an assistant image or upload one from the device.
3. Name the assistant.
4. Talk to the assistant with voice input and spoken replies.

## Tech Stack

- Frontend: React, Vite, plain CSS
- Backend: Express, CORS, dotenv, Gemini SDK
- Browser APIs: Web Speech Recognition and Speech Synthesis
- State: React state and localStorage

## Project Structure

```text
VirtualAssistant/
  frontend/
    src/
      App.jsx
      main.jsx
      styles.css
      hooks/usePersistentUser.js
      lib/api.js
  backend/
    src/
      app.js
      server.js
      routes/
      services/
  package.json
```

## Run Locally

Install dependencies:

```bash
npm run install:all
```

Start the backend:

```bash
npm run dev:backend
```

Start the frontend in another terminal:

```bash
npm run dev:frontend
```

The frontend runs on `http://localhost:5173` and the API runs on `http://localhost:4000`.

## Gemini Responses

To enable real AI answers, create `backend/.env`:

```bash
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-3.5-flash
```

Then restart the backend. Without `GEMINI_API_KEY`, the app still runs, but the assistant uses a simple local fallback response. Create or manage your Gemini key in Google AI Studio.

## Notes

Voice recognition support depends on the browser; Chrome-based browsers work best.
