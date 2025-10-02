#!/bin/bash

echo "🚀 Building and deploying Boston Open Mics frontend for production..."

# Build the production version
echo "📦 Building production bundle..."
npm run build

echo "✅ Production build complete!"
echo ""
echo "🌐 Frontend is configured to use:"
echo "API URL: https://alaz4y94pg.execute-api.us-east-2.amazonaws.com/prod/api"
echo ""
echo "📁 Production files are in the 'dist' directory"
echo "You can now deploy the 'dist' folder to your hosting service (Netlify, Vercel, S3, etc.)"
echo ""
echo "🧪 To test locally with production API:"
echo "npm run preview"