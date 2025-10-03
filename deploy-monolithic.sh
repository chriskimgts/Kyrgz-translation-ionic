#!/bin/bash

echo "🚀 Starting monolithic deployment..."

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "server" ]; then
    echo "❌ Error: Must be run from project root directory"
    echo "   Expected: package.json and server/ folder"
    exit 1
fi

# Build the frontend for production
echo "📦 Building frontend for production..."
npm run build:prod
if [ $? -ne 0 ]; then
    echo "❌ Frontend build failed!"
    exit 1
fi

# Build the backend
echo "🔧 Building backend..."
cd server
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Backend build failed!"
    exit 1
fi
cd ..

# Deploy to Firebase Hosting (frontend)
echo "🔥 Deploying frontend to Firebase Hosting..."
firebase deploy --only hosting
if [ $? -ne 0 ]; then
    echo "❌ Firebase deployment failed!"
    exit 1
fi

# Deploy to Cloud Run (backend)
echo "☁️ Deploying backend to Cloud Run..."
cd server
gcloud run deploy live-translator-api \
    --source . \
    --region us-central1 \
    --allow-unauthenticated \
    --platform managed
cd ..

if [ $? -eq 0 ]; then
    echo "✅ Monolithic deployment successful!"
    echo "🌐 Frontend: https://translation-5c1b8.web.app"
    echo "☁️ Backend: https://live-translator-api-714048340715.us-central1.run.app"
else
    echo "❌ Cloud Run deployment failed!"
    exit 1
fi
