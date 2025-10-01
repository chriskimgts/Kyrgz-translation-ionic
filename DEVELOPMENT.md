# 🚀 Development Setup

This project now uses a **monolithic architecture** with both frontend and backend in the same repository.

## 📁 Project Structure

```
Kyrgz-translation-ionic/
├── src/                    # Ionic/Angular frontend
├── server/                 # Node.js/Express backend
├── android/               # Android build files
├── ios/                   # iOS build files
├── www/                   # Built frontend (for mobile)
├── Dockerfile             # Container configuration
├── start-dev.sh          # Start both frontend & backend
├── start-server.sh       # Start only backend
├── deploy-web.sh         # Deploy to production
└── deploy-monolithic.sh  # Deploy both frontend & backend
```

## 🛠️ Development Commands

### Start Everything (Recommended)
```bash
./start-dev.sh
```
This will:
- ✅ Start backend server on `http://localhost:8788`
- ✅ Start frontend dev server on `http://localhost:4200`
- ✅ Handle port conflicts automatically
- ✅ Install dependencies if needed

### Start Backend Only
```bash
./start-server.sh
```
- Starts only the backend server on port 8788
- Useful for testing API endpoints

### Start Frontend Only
```bash
ng serve --port 4200
```
- Starts only the frontend development server
- Make sure backend is running separately

## 🌐 URLs

### Development
- **Frontend**: http://localhost:4200
- **Backend API**: http://localhost:8788
- **Health Check**: http://localhost:8788/health

### Production
- **Frontend**: https://translation-5c1b8.web.app
- **Backend API**: https://live-translator-api-714048340715.us-central1.run.app

## 🔧 Environment Configuration

The app automatically uses the correct API URL based on environment:

- **Development** (`environment.ts`): Uses `http://localhost:8788`
- **Production** (`environment.prod.ts`): Uses Cloud Run URL

## 📱 Mobile Development

### iOS
```bash
# Build and run on iOS simulator
npx cap run ios
```

### Android
```bash
# Build and run on Android emulator
npx cap run android
```

## 🚀 Deployment

### Deploy Everything (Frontend + Backend)
```bash
./deploy-web.sh
```

### Deploy Frontend Only
```bash
firebase deploy --only hosting
```

### Deploy Backend Only
```bash
gcloud run deploy live-translator-api --source . --region us-central1 --allow-unauthenticated --clear-base-image
```

## 🐛 Debugging

### Backend Logs
```bash
# View Cloud Run logs
gcloud run services logs read live-translator-api --region=us-central1 --limit=50

# View local server logs
# (logs appear in the terminal where you started the server)
```

### Frontend Debugging
- Open browser dev tools (F12)
- Check Console tab for API calls and errors
- Network tab shows API requests/responses

### Test Transcription Issue
1. Open browser dev tools
2. Go to Console tab
3. Say "hurry" into the microphone
4. Look for debug logs:
   - `🎤 TRANSCRIPTION DEBUG:` (frontend)
   - `🎤 BACKEND TRANSCRIPTION DEBUG:` (backend)
   - `🔄 TRANSLATION DEBUG:` (translation)

## 🔍 Troubleshooting

### Port Already in Use
```bash
# Kill processes using ports
lsof -ti:4200 | xargs kill -9  # Frontend
lsof -ti:8788 | xargs kill -9  # Backend
```

### Backend Build Fails
```bash
cd server
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Frontend Build Fails
```bash
rm -rf node_modules package-lock.json
npm install
npm run build:prod
```

## 📝 API Endpoints

- `GET /health` - Health check
- `POST /api/transcribe` - Speech-to-text
- `POST /api/translate` - Text translation
- `POST /api/tts` - Text-to-speech
- `POST /api/prime-language` - Language priming

## 🎯 Key Features Fixed

- ✅ **End Button Buffer Clearing**: Always clears buffers when end button is clicked
- ✅ **English Language Detection**: Fixed "hurry" vs "thank you" transcription issue
- ✅ **iOS Speech Detection**: Improved audio format compatibility
- ✅ **Monolithic Architecture**: Single repository for easier development
- ✅ **Local Development**: Easy local server setup
