# Bird Song Visualizer - Web Application

A client-side web application that visualizes bird songs from video files. Runs entirely in the browser with optional backend proxy for advanced features.

## Features

- **Video Import**: Upload bird videos from your device
- **Audio Extraction**: Native browser extraction with ffmpeg.wasm fallback
- **Audio Enhancement**: 
  - Client-side noise reduction (always available)
  - ML-based source separation (requires backend proxy)
- **2D Spectrogram**: Visualize frequency content over time
- **3D Acoustic Manifold**: Interactive 3D trajectory visualization with synchronized audio playback
- **Video Export**: Download videos of the manifold visualization

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Architecture

- **React + TypeScript**: UI framework
- **Vite**: Build tool and dev server
- **Three.js**: 3D visualization
- **ffmpeg.wasm**: Audio/video processing
- **Web Workers**: Heavy DSP computations

## Browser Support

- iOS Safari 14+
- Chrome/Edge (desktop and mobile)
- Firefox (desktop and mobile)

## Backend Proxy (Optional)

For source separation features, see `backend-proxy/README.md` for deployment instructions.

## Deployment

Build the project:
```bash
npm run build
```

Deploy the `dist/` folder to any static hosting service (GitHub Pages, Vercel, Netlify, etc.).
