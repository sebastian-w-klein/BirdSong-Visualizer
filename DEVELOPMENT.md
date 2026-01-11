# 🛠️ Development Workflow

This guide explains how to develop new features without affecting the deployed version.

## Branch Strategy

- **`main`** - Production branch (auto-deploys to GitHub Pages)
- **`develop`** - Development branch (safe to experiment)

## Workflow

### 1. Work on Development Branch

```powershell
# Make sure you're on develop branch
git checkout develop

# Create a feature branch for your work
git checkout -b feature/your-feature-name

# Make your changes, test locally
npm run dev  # in web/ directory

# Commit your changes
git add .
git commit -m "Add new feature"

# Push to GitHub (won't deploy)
git push origin feature/your-feature-name
```

### 2. Test Locally

```powershell
cd web
npm run dev
```

Visit `http://localhost:5173` to test your changes.

### 3. When Ready to Deploy

```powershell
# Switch to main branch
git checkout main

# Merge your feature
git merge develop  # or merge specific feature branch

# Push to main (this triggers deployment)
git push origin main
```

## Important Notes

- ✅ **Only `main` branch triggers deployment** - Work on `develop` or feature branches won't affect the live site
- ✅ **Test locally first** - Use `npm run dev` to test changes before merging
- ✅ **Keep `main` stable** - Only merge when features are tested and ready

## Quick Commands

```powershell
# Start development
git checkout develop
cd web
npm run dev

# Create new feature
git checkout -b feature/new-feature
# ... make changes ...
git add .
git commit -m "Add new feature"
git push origin feature/new-feature

# Deploy to production
git checkout main
git merge develop
git push origin main
```

## Local Testing

The app runs locally at `http://localhost:5173`:

```powershell
cd web
npm install  # First time only
npm run dev
```

## Backend Proxy (Local)

To test backend features locally:

```powershell
cd web/backend-proxy
npm install
$env:HUGGINGFACE_API_KEY="your_key_here"
npm start
```

Then update `web/.env.local`:
```
VITE_PROXY_URL=http://localhost:3000/api/separate-audio
VITE_USE_PROXY=true
```
