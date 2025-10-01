#!/bin/bash

echo "🚀 Starting Kyrgyz Translation App in Development Mode..."

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "server" ]; then
    echo "❌ Error: Must be run from project root directory"
    echo "   Expected: package.json and server/ folder"
    exit 1
fi

# Function to cleanup background processes on exit
cleanup() {
    echo "🛑 Shutting down development servers..."
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null
    fi
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null
    fi
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Check if ports are available
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "⚠️  Port $port is already in use. Please free it up first."
        echo "   You can kill processes using: lsof -ti:$port | xargs kill -9"
        exit 1
    fi
}

# Check ports
echo "🔍 Checking if ports are available..."
check_port 4200
check_port 8788

# Install dependencies if needed
echo "📦 Installing dependencies..."
if [ ! -d "node_modules" ]; then
    echo "   Installing frontend dependencies..."
    npm install
fi

if [ ! -d "server/node_modules" ]; then
    echo "   Installing backend dependencies..."
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
cd ..

# Start backend server
echo "🖥️  Starting backend server on port 8788..."
cd server
node dist/server.js &
BACKEND_PID=$!
cd ..

# Wait a moment for backend to start
sleep 3

# Check if backend started successfully
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "❌ Backend server failed to start!"
    exit 1
fi

echo "✅ Backend server started successfully!"

# Start frontend development server
echo "🌐 Starting frontend development server on port 4200..."
ng serve --port 4200 &
FRONTEND_PID=$!

# Wait a moment for frontend to start
sleep 5

# Check if frontend started successfully
if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    echo "❌ Frontend server failed to start!"
    cleanup
    exit 1
fi

echo "✅ Frontend server started successfully!"

echo ""
echo "🎉 Development servers are running!"
echo "🌐 Frontend: http://localhost:4200"
echo "🖥️  Backend:  http://localhost:8788"
echo "📊 Backend Health: http://localhost:8788/health"
echo ""
echo "Press Ctrl+C to stop both servers"

# Wait for user to stop
wait
