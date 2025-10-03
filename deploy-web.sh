#!/bin/bash

echo "🚀 Deploying Kyrgyz Translation Ionic App (Monolithic Architecture)..."

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "server" ]; then
    echo "❌ Error: Must be run from project root directory"
    echo "   Expected: package.json and server/ folder"
    exit 1
fi

# Build the frontend for production
echo "📦 Building frontend for production..."
npm run build:prod

if [ $? -eq 0 ]; then
    echo "✅ Frontend build successful!"

    # Check if www directory exists
    if [ -d "www" ]; then
        echo "📁 Build output found in www/ directory"
        echo "📊 Build size:"
        du -sh www/

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

        if [ $? -eq 0 ]; then
            echo "✅ Frontend deployment successful!"

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
        else
            echo "❌ Firebase deployment failed!"
            echo "💡 Make sure you have:"
            echo "   1. Firebase CLI installed: npm install -g firebase-tools"
            echo "   2. Firebase project initialized: firebase init"
            echo "   3. Firebase login: firebase login"
            exit 1
        fi

    else
        echo "❌ Build output directory 'www' not found!"
        exit 1
    fi
else
    echo "❌ Frontend build failed!"
    exit 1
fi
