# CORS Proxy Setup for Hugging Face API

The Hugging Face Inference API doesn't allow direct browser requests due to CORS restrictions. You have a few options:

## Option 1: Use a Free CORS Proxy (Quick, but Limited)

The current implementation uses `api.allorigins.win` as a free CORS proxy. This works but:
- May have rate limits
- Not ideal for production
- May be slower

## Option 2: Set Up a Simple Backend Proxy (Recommended)

Create a simple backend service to proxy requests to Hugging Face API.

### Using Node.js/Express (Free on Railway/Render):

```javascript
// server.js
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.post('/api/separate-audio', async (req, res) => {
  try {
    const { audioBlob, model } = req.body;
    
    const response = await fetch(
      `https://api-inference.huggingface.co/models/${model}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
        },
        body: Buffer.from(audioBlob, 'base64'),
      }
    );
    
    const audioBuffer = await response.arrayBuffer();
    res.send(Buffer.from(audioBuffer).toString('base64'));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000);
```

Then update `audioEnhancement.ts` to use your backend:
```typescript
const response = await fetch('http://your-backend-url/api/separate-audio', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    audioBlob: await blobToBase64(audioBlob),
    model: 'facebook/demucs',
  }),
});
```

## Option 3: Use Replicate API Instead

Replicate API has better CORS support. You can switch to Replicate:

1. Get API key from https://replicate.com
2. Update the API call to use Replicate's endpoint
3. Replicate has better CORS handling

## Current Status

The code currently uses `api.allorigins.win` as a CORS proxy. This should work for testing, but for production use, set up Option 2 (backend proxy).
