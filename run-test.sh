#!/bin/bash

echo "🚀 Starting Boston Open Mics Test Environment"
echo ""
echo "Backend (mock data): http://localhost:5002"
echo "Frontend: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

# Function to kill background processes on exit
cleanup() {
    echo ""
    echo "Stopping servers..."
    kill $SERVER_PID $CLIENT_PID 2>/dev/null
    exit
}

# Set up trap to cleanup on exit
trap cleanup SIGINT SIGTERM

# Start the test server in background
node server/test-server.js &
SERVER_PID=$!

# Wait a moment for server to start
sleep 2

# Start the client in background
cd client && npm run dev &
CLIENT_PID=$!

# Wait for both processes
wait