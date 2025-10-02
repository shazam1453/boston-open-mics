#!/bin/bash

echo "🚀 Deploying Boston Open Mics API to AWS..."

# Check if serverless is installed
if ! command -v serverless &> /dev/null; then
    echo "❌ Serverless Framework not found. Installing..."
    npm install -g serverless
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Deploy to AWS
echo "☁️ Deploying to AWS..."
serverless deploy --stage prod

echo "✅ Deployment complete!"
echo ""
echo "Your API endpoints:"
echo "- Health Check: https://your-api-id.execute-api.us-east-2.amazonaws.com/prod/health"
echo "- API Base URL: https://your-api-id.execute-api.us-east-2.amazonaws.com/prod/api"
echo ""
echo "Don't forget to update your client's VITE_API_URL environment variable!"