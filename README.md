# 🐦 Bird Song Visualizer

A beautiful web application that transforms bird videos into stunning 3D acoustic manifolds. Upload a bird video, and watch as the app extracts audio, computes acoustic features, and visualizes the bird's song as an interactive 3D trajectory.

## ✨ Features

- **📹 Video Import**: Upload bird videos directly from your device
- **🎵 Audio Extraction**: Extracts and processes audio from video files
- **📊 2D Spectrogram**: Visualize frequency content over time
- **🎨 3D Acoustic Manifold**: Interactive 3D visualization of the bird's song trajectory
- **🎛️ Audio Enhancement**: Optional noise reduction and bird song isolation
- **🎬 Video Export**: Download videos of the manifold visualization
- **🔊 Audio Playback**: Synchronized audio playback with the 3D animation

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- A modern web browser (Chrome, Firefox, Safari, Edge)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd birdsong
```

2. Install dependencies:
```bash
cd web
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser to `http://localhost:5173`

### Building for Production

```bash
cd web
npm run build
```

The built files will be in `web/dist/` and can be deployed to any static hosting service.

## 📁 Project Structure

```
birdsong/
├── web/                    # Web application
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── dsp/            # Digital signal processing
│   │   ├── utils/          # Utility functions
│   │   └── workers/        # Web Workers
│   ├── backend-proxy/      # Optional backend proxy for API calls
│   └── package.json
└── README.md
```

## 🎯 Usage

1. **Import Video**: Click "Import Bird Video" and select a video file
2. **Configure Options**: 
   - Enable "Reduce noise" for basic noise reduction (recommended)
   - Enable "Isolate bird song" for advanced source separation (requires internet)
3. **Process**: Click "Process" and wait for analysis
4. **Explore**: 
   - View the 2D spectrogram
   - Interact with the 3D manifold (drag to rotate, scroll to zoom)
   - Play the animation with synchronized audio
   - Download videos of the visualization

## 🔧 Technical Details

### Digital Signal Processing

- **STFT**: Short-Time Fourier Transform with Hann windowing
- **Mel Filterbank**: 128 mel-scale filters (500-12000 Hz)
- **MFCC**: 40 Mel-Frequency Cepstral Coefficients
- **PCA**: Principal Component Analysis to 3D for visualization

### Audio Processing

- Native browser audio extraction with ffmpeg.wasm fallback
- Client-side noise reduction (high-pass filter + spectral gating)
- Optional ML-based source separation via Hugging Face API

### Visualization

- **Spectrogram**: HTML Canvas 2D rendering
- **3D Manifold**: Three.js with interactive controls
- **Video Export**: Canvas frame capture with ffmpeg.wasm encoding

## 🌐 Deployment

### GitHub Pages

1. Build the project:
```bash
cd web
npm run build
```

2. Configure GitHub Pages to serve from `web/dist/`

3. Update `vite.config.ts` base path if needed

### Other Hosting

The built files in `web/dist/` can be deployed to:
- Vercel
- Netlify
- Cloudflare Pages
- Any static hosting service

## 🔐 Backend Proxy (Optional)

For source separation features, you need to deploy the backend proxy:

```bash
cd web/backend-proxy
npm install
```

**Important Security Note**: Set `HUGGINGFACE_API_KEY` as an environment variable on your hosting platform. **Never commit your API key to the repository!**

Deploy to:
- Railway (recommended - easiest setup)
- Render
- Fly.io
- Any Node.js hosting service

See `web/backend-proxy/README.md` for detailed deployment instructions.

## 📝 License

[Add your license here]

## 🙏 Acknowledgments

- Three.js for 3D visualization
- ffmpeg.wasm for audio/video processing
- Hugging Face for source separation API
