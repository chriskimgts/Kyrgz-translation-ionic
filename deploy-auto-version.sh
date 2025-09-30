#!/bin/bash

echo "🚀 Auto-deploying Kyrgyz Translation Ionic App with Version Increment..."

# Get current version from package.json
CURRENT_VERSION=$(grep '"version"' package.json | sed 's/.*"version": *"\([^"]*\)".*/\1/')
echo "📦 Current version: $CURRENT_VERSION"

# Increment patch version automatically
IFS='.' read -ra VERSION_PARTS <<< "$CURRENT_VERSION"
major=${VERSION_PARTS[0]}
minor=${VERSION_PARTS[1]}
patch=${VERSION_PARTS[2]}
patch=$((patch + 1))

NEW_VERSION="${major}.${minor}.${patch}"
MAJOR_VERSION=$major

echo "🔄 Auto-incrementing patch version: $CURRENT_VERSION → $NEW_VERSION"

# Update package.json
echo "📝 Updating package.json..."
sed -i.bak "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" package.json

# Update navigation component
echo "📝 Updating navigation component..."
sed -i.bak "s/private readonly CURRENT_VERSION = [0-9]*/private readonly CURRENT_VERSION = $MAJOR_VERSION/" src/app/navigation/navigation.component.ts
sed -i.bak "s/currentVersion: number = [0-9]*/currentVersion: number = $MAJOR_VERSION/" src/app/navigation/navigation.component.ts

# Update Android version
echo "📝 Updating Android version..."
sed -i.bak "s/versionName \"[^\"]*\"/versionName \"$NEW_VERSION\"/" android/app/build.gradle

# Clean up backup files
rm -f package.json.bak
rm -f src/app/navigation/navigation.component.ts.bak
rm -f android/app/build.gradle.bak

echo "✅ Version updated successfully!"

# Build the production version
echo ""
echo "📦 Building production version..."
npm run build:prod

if [ $? -eq 0 ]; then
    echo "✅ Production build successful!"

    # Deploy to Firebase
    echo ""
    echo "🌐 Deploying to Firebase..."
    firebase deploy --only hosting

    if [ $? -eq 0 ]; then
        echo ""
        echo "🎉 Auto-deployment successful!"
        echo "📊 Version: $NEW_VERSION"
        echo "🌐 URL: https://translation-5c1b8.web.app"
        echo ""
        echo "📱 Version updated in:"
        echo "   ✅ package.json: $NEW_VERSION"
        echo "   ✅ navigation.component.ts: v$MAJOR_VERSION"
        echo "   ✅ android/app/build.gradle: $NEW_VERSION"
        echo "   ✅ Firebase hosting: deployed"
    else
        echo "❌ Firebase deployment failed!"
        exit 1
    fi
else
    echo "❌ Production build failed!"
    exit 1
fi
