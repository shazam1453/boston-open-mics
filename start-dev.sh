#!/bin/bash

echo "🚀 Starting Boston Open Mics Development Environment"
echo ""

# Check if PostgreSQL is running
if ! pgrep -x "postgres" > /dev/null; then
    echo "⚠️  PostgreSQL is not running. Please start PostgreSQL first:"
    echo "   macOS: brew services start postgresql"
    echo "   Ubuntu: sudo service postgresql start"
    echo ""
fi

echo "📦 Installing dependencies..."
npm run install:all

echo ""
echo "🗄️  To set up the database, run:"
echo "   cd server && npm run setup-db"
echo ""

echo "🖥️  Starting servers..."
echo "   Backend will run on: http://localhost:5001"
echo "   Frontend will run on: http://localhost:3000"
echo ""

# Start both servers
npm run dev