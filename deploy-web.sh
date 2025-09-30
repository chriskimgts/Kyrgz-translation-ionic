#!/bin/bash

echo "🚀 Deploying Kyrgyz Translation Ionic App to Firebase..."

# Build the production version
echo "📦 Building production version..."
npm run build:prod

if [ $? -eq 0 ]; then
    echo "✅ Production build successful!"

    # Check if www directory exists
    if [ -d "www" ]; then
        echo "📁 Build output found in www/ directory"
        echo "📊 Build size:"
        du -sh www/

        # Deploy to Firebase
        echo "🔥 Deploying to Firebase..."
        firebase deploy --only hosting

        if [ $? -eq 0 ]; then
            echo "✅ Deployment successful!"
            echo "🌐 Your Ionic app is now live on Firebase Hosting!"
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
    echo "❌ Production build failed!"
    exit 1
fi
