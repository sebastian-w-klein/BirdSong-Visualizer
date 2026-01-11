# Backend Proxy for Hugging Face API

This simple backend proxy solves the CORS issue when calling Hugging Face API from the browser.

## Quick Deploy (Free Options)

### Option 1: Railway (Recommended - Easiest)

1. Go to https://railway.app
2. Click "New Project" → "Deploy from GitHub repo"
3. Connect your repo and select the `backend-proxy` folder
4. Add environment variable: `HUGGINGFACE_API_KEY=your_key_here`
5. Deploy!

Railway gives you a free URL like: `https://your-app.railway.app`

### Option 2: Render

1. Go to https://render.com
2. Click "New" → "Web Service"
3. Connect your repo
4. Set:
   - Build Command: `npm install`
   - Start Command: `node server.js`
   - Environment Variable: `HUGGINGFACE_API_KEY=your_key_here`
5. Deploy!

### Option 3: Fly.io

1. Install Fly CLI: `curl -L https://fly.io/install.sh | sh`
2. Run: `fly launch`
3. Set secret: `fly secrets set HUGGINGFACE_API_KEY=your_key_here`
4. Deploy: `fly deploy`

## Local Testing

1. Navigate to the backend-proxy directory:
   ```bash
   cd web/backend-proxy
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set environment variable:
   ```bash
   # On Windows PowerShell:
   $env:HUGGINGFACE_API_KEY="your_api_key_here"
   
   # On Windows CMD:
   set HUGGINGFACE_API_KEY=your_api_key_here
   
   # On Mac/Linux:
   export HUGGINGFACE_API_KEY=your_api_key_here
   ```
   
   **Important**: Replace `your_api_key_here` with your actual Hugging Face API key. Never commit your API key to version control!

4. Run server:
   ```bash
   npm start
   ```

5. Server runs on http://localhost:3000

## Update Frontend

After deploying, update `web/src/utils/audioEnhancement.ts`:

```typescript
// Change the API_URL to your deployed proxy URL
const PROXY_URL = 'https://your-app.railway.app/api/separate-audio';
```
