# 🚀 Deploy Boston Open Mics to Netlify

## Quick Setup (5 minutes)

### Step 1: Push to GitHub
Make sure your code is pushed to a GitHub repository.

### Step 2: Connect to Netlify

1. **Go to [Netlify](https://netlify.com)** and sign up/login
2. **Click "Add new site"** → "Import an existing project"
3. **Connect to GitHub** and select your repository
4. **Configure build settings**:
   - **Build command**: `npm run build:prod`
   - **Publish directory**: `dist`
   - **Node version**: `18` (set in netlify.toml)

### Step 3: Deploy!
Click "Deploy site" - Netlify will automatically build and deploy your app!

## 🔧 Configuration Files

I've created these files for you:

### `netlify.toml` (Main config)
- Sets build command and publish directory
- Configures SPA redirects for React Router
- Sets environment variables for all contexts

### `_redirects` (Backup SPA routing)
- Ensures all routes redirect to index.html
- Handles client-side routing properly

## 🌐 What Happens Next

1. **Netlify builds your app** using `npm run build:prod`
2. **Deploys to a temporary URL** like `https://amazing-name-123456.netlify.app`
3. **You can customize the domain** in Netlify settings
4. **Auto-deploys on every push** to your main branch

## ✅ Verification Steps

After deployment:

1. **Check the site loads**: Visit your Netlify URL
2. **Test API connection**: Try logging in or viewing events
3. **Test routing**: Navigate between pages (should work without page refresh)
4. **Check console**: No CORS or API errors

## 🎯 Expected Results

Your app will be live at a URL like:
- `https://boston-open-mics.netlify.app` (if you customize the name)
- `https://amazing-name-123456.netlify.app` (default random name)

## 🔍 Troubleshooting

### Build Fails
- Check the build logs in Netlify dashboard
- Ensure all dependencies are in `package.json`
- Verify TypeScript compiles: `npm run build:prod` locally

### API Connection Issues
- Verify the API URL in netlify.toml matches your AWS deployment
- Test API directly: `https://alaz4y94pg.execute-api.us-east-2.amazonaws.com/prod/health`
- Check browser console for CORS errors

### Routing Issues (404 on refresh)
- The `_redirects` file should handle this
- Verify it's in the root of your `client` directory

## 🚀 Advanced Options

### Custom Domain
1. Go to Netlify dashboard → Domain settings
2. Add your custom domain
3. Netlify provides free SSL certificates

### Environment Variables
You can also set environment variables in Netlify dashboard:
- Go to Site settings → Environment variables
- Add `VITE_API_URL` if needed

### Deploy Previews
- Every pull request gets its own preview URL
- Perfect for testing before merging

## 📊 Performance

Expected performance:
- **Build time**: 1-2 minutes
- **Deploy time**: 30 seconds
- **Site speed**: Excellent (static files on CDN)
- **Lighthouse score**: 90+ (optimized React build)

## 🎉 You're Done!

Once deployed, your Boston Open Mics platform will be:
- ✅ Live on the internet
- ✅ Connected to your AWS API
- ✅ Auto-deploying on code changes
- ✅ Optimized for performance
- ✅ SSL secured (HTTPS)

Share your live URL and start managing those open mic events! 🎤