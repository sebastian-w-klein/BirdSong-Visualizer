/**
 * Simple backend proxy for Hugging Face API
 * Deploy to Railway, Render, or Fly.io (all have free tiers)
 * 
 * To deploy:
 * 1. Install dependencies: npm install
 * 2. Set HUGGINGFACE_API_KEY environment variable
 * 3. Deploy to your chosen platform
 */

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fetch = require('node-fetch');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// Enable CORS for all routes
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Root endpoint - just for testing
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok',
    message: 'Hugging Face Audio Proxy Server',
    endpoints: {
      health: '/health',
      separateAudio: '/api/separate-audio (POST)'
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Audio source separation endpoint
app.post('/api/separate-audio', upload.single('audio'), async (req, res) => {
  try {
    const apiKey = process.env.HUGGINGFACE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'HUGGINGFACE_API_KEY not configured' });
    }

    const model = req.body.model || 'facebook/demucs';
    
    // Get audio file from request
    const audioFile = req.file;
    if (!audioFile) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    console.log(`Processing audio separation with model: ${model}`);

    // Forward request to Hugging Face API
    const response = await fetch(
      `https://api-inference.huggingface.co/models/${model}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        body: audioFile.buffer,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Hugging Face API error:', response.status, errorText);
      return res.status(response.status).json({ 
        error: `Hugging Face API error: ${errorText}` 
      });
    }

    // Get the separated audio
    const audioBuffer = await response.arrayBuffer();
    
    // Return as base64 for easy client-side handling
    const base64Audio = Buffer.from(audioBuffer).toString('base64');
    
    res.json({ 
      audio: base64Audio,
      contentType: response.headers.get('content-type') || 'audio/wav'
    });

  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
});
