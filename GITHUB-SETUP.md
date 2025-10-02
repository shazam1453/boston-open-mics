# 🐙 GitHub Setup Instructions

## Step 1: Create GitHub Repository

1. Go to [GitHub.com](https://github.com) and login
2. Click the "+" icon → "New repository"
3. Repository name: `boston-open-mics` (or your preferred name)
4. Description: `Complete open mic management platform for Boston`
5. Make it **Public** (so Netlify can access it)
6. **Don't** initialize with README (we already have one)
7. Click "Create repository"

## Step 2: Connect Local Repository

After creating the GitHub repo, run these commands:

```bash
# Add your GitHub repository as remote origin
git remote add origin https://github.com/YOUR_USERNAME/boston-open-mics.git

# Push to GitHub
git push -u origin main
```

Replace `YOUR_USERNAME` with your actual GitHub username.

## Step 3: Verify Upload

Check your GitHub repository page - you should see all 75 files uploaded!

## Step 4: Deploy to Netlify

1. Go to [Netlify.com](https://netlify.com)
2. Click "Add new site" → "Import an existing project"
3. Choose "Deploy with GitHub"
4. Select your `boston-open-mics` repository
5. Netlify will automatically detect the settings from `netlify.toml`:
   - Build command: `npm run build:prod`
   - Publish directory: `dist`
   - Base directory: `client`

## 🎉 You're Done!

Once pushed to GitHub and deployed to Netlify:
- ✅ Code is safely backed up on GitHub
- ✅ Automatic deployments on every push
- ✅ Live website with your AWS API backend
- ✅ Professional development workflow

## 📝 Next Steps

1. **Custom domain** (optional): Add your own domain in Netlify settings
2. **Environment variables**: Already configured in netlify.toml
3. **SSL certificate**: Automatically provided by Netlify
4. **Deploy previews**: Every pull request gets a preview URL

Your Boston Open Mics platform will be live and ready for users! 🎤