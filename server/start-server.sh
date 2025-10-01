#!/bin/bash

echo "🖥️  Starting Backend Server..."

# Check if we're in the right directory
if [ ! -d "server" ]; then
    echo "❌ Error: server/ folder not found"
    echo "   Run this from the project root directory"
    exit 1
fi

# Check if port is available
if lsof -Pi :8788 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️  Port 8788 is already in use."
    echo "   Killing existing process..."
    lsof -ti:8788 | xargs kill -9
    sleep 2
fi

# Install dependencies if needed
if [ ! -d "server/node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    cd server
    npm install
    cd ..
fi

# Build backend
echo "🔧 Building backend..."
cd server
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Backend build failed!"
    exit 1
fi

# Start server
echo "🚀 Starting server on port 8788..."
echo "📊 Health check: http://localhost:8788/health"
echo "🛑 Press Ctrl+C to stop"
echo ""

node dist/server.js
