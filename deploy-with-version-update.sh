#!/bin/bash

echo "🚀 Deploying Kyrgyz Translation Ionic App with Version Update..."

# Function to increment version number
increment_version() {
    local version=$1
    local part=$2  # major, minor, or patch

    # Split version into parts
    IFS='.' read -ra VERSION_PARTS <<< "$version"
    major=${VERSION_PARTS[0]}
    minor=${VERSION_PARTS[1]}
    patch=${VERSION_PARTS[2]}

    case $part in
        "major")
            major=$((major + 1))
            minor=0
            patch=0
            ;;
        "minor")
            minor=$((minor + 1))
            patch=0
            ;;
        "patch")
            patch=$((patch + 1))
            ;;
        *)
            echo "Invalid version part. Use: major, minor, or patch"
            exit 1
            ;;
    esac

    echo "${major}.${minor}.${patch}"
}

# Get current version from package.json
CURRENT_VERSION=$(grep '"version"' package.json | sed 's/.*"version": *"\([^"]*\)".*/\1/')
echo "📦 Current version: $CURRENT_VERSION"

# Ask user which part to increment
echo ""
echo "Which version part would you like to increment?"
echo "1) Patch (1.0.0 → 1.0.1) - Bug fixes"
echo "2) Minor (1.0.0 → 1.1.0) - New features"
echo "3) Major (1.0.0 → 2.0.0) - Breaking changes"
echo "4) Custom version"
echo ""
read -p "Enter your choice (1-4): " choice

case $choice in
    1)
        NEW_VERSION=$(increment_version "$CURRENT_VERSION" "patch")
        ;;
    2)
        NEW_VERSION=$(increment_version "$CURRENT_VERSION" "minor")
        ;;
    3)
        NEW_VERSION=$(increment_version "$CURRENT_VERSION" "major")
        ;;
    4)
        read -p "Enter new version (e.g., 1.2.3): " NEW_VERSION
        ;;
    *)
        echo "Invalid choice. Using patch increment."
        NEW_VERSION=$(increment_version "$CURRENT_VERSION" "patch")
        ;;
esac

echo ""
echo "🔄 Updating version from $CURRENT_VERSION to $NEW_VERSION"

# Extract major version number for navigation component
MAJOR_VERSION=$(echo $NEW_VERSION | cut -d. -f1)

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
        echo "🎉 Deployment successful!"
        echo "📊 Version: $NEW_VERSION"
        echo "🌐 URL: https://translation-5c1b8.web.app"
        echo ""
        echo "📱 Next steps:"
        echo "   - Test the new version on the live site"
        echo "   - Update mobile app versions if needed"
        echo "   - Commit version changes to git"
    else
        echo "❌ Firebase deployment failed!"
        exit 1
    fi
else
    echo "❌ Production build failed!"
    exit 1
fi

