# 🚀 Complete Deployment Guide

This guide walks you through deploying both the frontend (GitHub Pages) and backend proxy.

## Part 1: Deploy Frontend to GitHub Pages

### Step 1: Enable GitHub Pages

1. Go to your repository: https://github.com/sebastian-w-klein/BirdSong-Visualizer
2. Click **Settings** (top menu)
3. Scroll down to **Pages** (left sidebar)
4. Under **Source**, select:
   - **Source**: `GitHub Actions`
5. Click **Save**

### Step 2: Push the Deployment Workflow

The GitHub Actions workflow is already in `.github/workflows/deploy.yml`. Just commit and push:

```powershell
git add .
git commit -m "Add GitHub Pages deployment workflow"
git push
```

### Step 3: Verify Deployment

1. Go to your repo → **Actions** tab
2. You should see a workflow run called "Deploy to GitHub Pages"
3. Wait for it to complete (green checkmark)
4. Your site will be live at: `https://sebastian-w-klein.github.io/BirdSong-Visualizer/`

**Note**: The first deployment may take 2-3 minutes. Future deployments happen automatically on every push to `main`.

---

## Part 2: Deploy Backend Proxy (for Source Separation)

The backend proxy is needed for the "Isolate bird song" feature. Choose one option:

### Option A: Railway (Recommended - Easiest)

#### Step 1: Sign Up
1. Go to https://railway.app
2. Click **"Start a New Project"** or **"Login"**
3. Sign up with GitHub (easiest)

#### Step 2: Create New Project
1. Click **"New Project"**
2. Select **"Deploy from GitHub repo"**
3. Authorize Railway to access your GitHub
4. Select your repository: `sebastian-w-klein/BirdSong-Visualizer`

#### Step 3: Configure Service
1. Railway will detect it's a Node.js project
2. Click on the service that was created
3. In the settings, you need to:
   - **Root Directory**: Set to `web/backend-proxy`
   - **Start Command**: Should auto-detect as `npm start`

#### Step 4: Set Environment Variable
1. In the service settings, go to **Variables** tab
2. Click **"New Variable"**
3. Add:
   - **Name**: `HUGGINGFACE_API_KEY`
   - **Value**: `your_huggingface_api_key_here` (replace with your actual key)
4. Click **Add**

#### Step 5: Deploy
1. Railway will automatically deploy
2. Wait for deployment to complete (green status)
3. Click on the service → **Settings** → **Generate Domain**
4. Copy the URL (e.g., `https://your-app-name.railway.app`)

#### Step 6: Update Frontend
1. Go to your GitHub repo
2. Create a new file: `web/.env.production`
3. Add this content:
   ```
   VITE_PROXY_URL=https://your-app-name.railway.app/api/separate-audio
   VITE_USE_PROXY=true
   ```
4. Replace `your-app-name.railway.app` with your actual Railway URL
5. Commit and push:
   ```powershell
   git add web/.env.production
   git commit -m "Configure backend proxy URL"
   git push
   ```

---

### Option B: Render (Alternative)

#### Step 1: Sign Up
1. Go to https://render.com
2. Sign up with GitHub

#### Step 2: Create Web Service
1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub repository
3. Select: `sebastian-w-klein/BirdSong-Visualizer`

#### Step 3: Configure
- **Name**: `bird-song-proxy` (or any name)
- **Root Directory**: `web/backend-proxy`
- **Environment**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `node server.js`

#### Step 4: Add Environment Variable
1. Scroll down to **Environment Variables**
2. Click **"Add Environment Variable"**
3. Add:
   - **Key**: `HUGGINGFACE_API_KEY`
   - **Value**: `your_huggingface_api_key_here` (replace with your actual key)

#### Step 5: Deploy
1. Click **"Create Web Service"**
2. Wait for deployment (takes 2-3 minutes)
3. Copy the service URL (e.g., `https://bird-song-proxy.onrender.com`)

#### Step 6: Update Frontend
Same as Railway - create `web/.env.production` with your Render URL.

---

## Part 3: Update Frontend to Use Backend Proxy

After deploying the backend proxy, you need to tell the frontend where it is:

### Method 1: Environment File (Recommended)

1. Create `web/.env.production`:
   ```
   VITE_PROXY_URL=https://your-proxy-url.railway.app/api/separate-audio
   VITE_USE_PROXY=true
   ```

2. Commit and push:
   ```powershell
   git add web/.env.production
   git commit -m "Add production environment variables"
   git push
   ```

3. The next GitHub Actions deployment will use this URL

### Method 2: Update Code Directly

If you prefer, you can update `web/src/utils/audioEnhancement.ts`:

```typescript
const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'https://your-proxy-url.railway.app/api/separate-audio';
```

---

## Part 4: Verify Everything Works

### Test Frontend
1. Visit: `https://sebastian-w-klein.github.io/BirdSong-Visualizer/`
2. Upload a bird video
3. Check "Reduce noise" (should work immediately)
4. Check "Isolate bird song" (requires backend proxy)

### Test Backend Proxy
1. Visit your proxy URL: `https://your-proxy-url.railway.app/health`
2. Should see: `{"status":"ok"}`

---

## Troubleshooting

### GitHub Pages Not Updating
- Check **Actions** tab for errors
- Make sure workflow completed successfully
- Wait 1-2 minutes after push for deployment

### Backend Proxy Not Working
- Check Railway/Render logs for errors
- Verify `HUGGINGFACE_API_KEY` is set correctly
- Test the `/health` endpoint
- Check browser console for CORS errors

### Source Separation Not Working
- Verify `VITE_PROXY_URL` is set correctly in `.env.production`
- Check that backend proxy is running (visit `/health`)
- Check browser console for fetch errors

---

## Quick Reference

- **Frontend URL**: `https://sebastian-w-klein.github.io/BirdSong-Visualizer/`
- **Backend Proxy**: Your Railway/Render URL
- **API Key**: Stored as environment variable on hosting platform (never in code)
