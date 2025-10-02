# Boston Open Mics - Frontend Deployment Guide

## 🌐 Production Configuration

The frontend is now configured to use the deployed AWS API:
- **API URL**: `https://alaz4y94pg.execute-api.us-east-2.amazonaws.com/prod/api`
- **Environment**: Production

## 🚀 Quick Deploy

### Option 1: Using the deploy script
```bash
npm run deploy:prod
```

### Option 2: Manual build
```bash
# Build for production
npm run build:prod

# Preview locally (optional)
npm run preview:prod
```

## 📁 Deployment Options

### 1. Netlify (Recommended)
1. Connect your GitHub repository to Netlify
2. Set build command: `npm run build:prod`
3. Set publish directory: `dist`
4. Deploy automatically on push to main branch

### 2. Vercel
1. Connect your GitHub repository to Vercel
2. Set build command: `npm run build:prod`
3. Set output directory: `dist`
4. Deploy automatically

### 3. AWS S3 + CloudFront
```bash
# Build the app
npm run build:prod

# Upload dist folder to S3 bucket
aws s3 sync dist/ s3://your-bucket-name --delete

# Invalidate CloudFront cache (if using)
aws cloudfront create-invalidation --distribution-id YOUR_DISTRIBUTION_ID --paths "/*"
```

### 4. GitHub Pages
1. Build the app: `npm run build:prod`
2. Push the `dist` folder to `gh-pages` branch
3. Enable GitHub Pages in repository settings

## 🔧 Environment Variables

### Development (.env)
```
VITE_API_URL=http://localhost:5002/api
```

### Production (.env.production)
```
VITE_API_URL=https://alaz4y94pg.execute-api.us-east-2.amazonaws.com/prod/api
```

## 🧪 Testing

### Test locally with production API:
```bash
npm run preview:prod
```

### Test locally with development API:
```bash
npm run dev
```

## 📊 Build Output

The production build creates:
- **index.html**: Main HTML file
- **assets/**: CSS and JavaScript bundles
- **Total size**: ~310KB (87KB gzipped)

## 🔍 Troubleshooting

### CORS Issues
If you encounter CORS errors, the API Gateway is configured to allow all origins (`*`). Make sure you're using the correct API URL.

### API Connection Issues
1. Verify the API URL in `.env.production`
2. Check that the AWS Lambda function is deployed and running
3. Test API endpoints directly: `https://alaz4y94pg.execute-api.us-east-2.amazonaws.com/prod/health`

### Build Issues
1. Make sure all dependencies are installed: `npm install`
2. Check TypeScript compilation: `npx tsc --noEmit`
3. Clear Vite cache: `rm -rf node_modules/.vite`

## 🎯 Next Steps

1. **Deploy the frontend** using one of the options above
2. **Test the full application** end-to-end
3. **Set up monitoring** for both frontend and backend
4. **Configure custom domain** (optional)

## 📚 Additional Resources

- [Vite Deployment Guide](https://vitejs.dev/guide/static-deploy.html)
- [React Deployment Guide](https://create-react-app.dev/docs/deployment/)
- [AWS S3 Static Website Hosting](https://docs.aws.amazon.com/AmazonS3/latest/userguide/WebsiteHosting.html)