/**
 * Audio enhancement utilities for noise reduction and source separation
 */

export interface AudioEnhancementOptions {
  enableNoiseReduction: boolean;
  enableSourceSeparation: boolean;
}

/**
 * Simple client-side noise reduction
 * - High-pass filter (remove wind/low-frequency noise)
 * - Spectral gating (remove background noise)
 */
export function reduceNoise(samples: Float32Array, sampleRate: number): Float32Array {
  // High-pass filter to remove low-frequency noise (wind, rumble)
  const cutoffFreq = 200; // Hz - remove frequencies below this
  const filtered = applyHighPassFilter(samples, sampleRate, cutoffFreq);
  
  // Spectral gating to remove background noise
  const enhanced = applySpectralGating(filtered, sampleRate);
  
  return enhanced;
}

/**
 * Apply high-pass filter using simple IIR filter
 */
function applyHighPassFilter(samples: Float32Array, sampleRate: number, cutoffFreq: number): Float32Array {
  const rc = 1.0 / (2.0 * Math.PI * cutoffFreq);
  const dt = 1.0 / sampleRate;
  const alpha = rc / (rc + dt);
  
  const filtered = new Float32Array(samples.length);
  let prevInput = 0;
  let prevOutput = 0;
  
  for (let i = 0; i < samples.length; i++) {
    filtered[i] = alpha * (prevOutput + samples[i] - prevInput);
    prevInput = samples[i];
    prevOutput = filtered[i];
  }
  
  return filtered;
}

/**
 * Apply spectral gating to remove background noise
 * Removes frequencies that are consistently quiet (background noise)
 */
function applySpectralGating(samples: Float32Array, sampleRate: number): Float32Array {
  const windowSize = 2048;
  const hopSize = 512;
  const noiseGateThreshold = 0.02; // Amplitude threshold
  
  const enhanced = new Float32Array(samples.length);
  
  // Calculate RMS energy in windows
  for (let i = 0; i < samples.length - windowSize; i += hopSize) {
    let sumSquared = 0;
    for (let j = 0; j < windowSize && i + j < samples.length; j++) {
      sumSquared += samples[i + j] * samples[i + j];
    }
    const rms = Math.sqrt(sumSquared / windowSize);
    
    // Apply gate: if RMS is below threshold, reduce amplitude
    const gateFactor = rms < noiseGateThreshold ? 0.1 : 1.0;
    
    for (let j = 0; j < hopSize && i + j < samples.length; j++) {
      enhanced[i + j] = samples[i + j] * gateFactor;
    }
  }
  
  // Fill remaining samples
  for (let i = Math.floor(samples.length / hopSize) * hopSize; i < samples.length; i++) {
    enhanced[i] = samples[i];
  }
  
  return enhanced;
}

/**
 * Call API for source separation (bird song isolation)
 * Uses Hugging Face Inference API or similar service
 */
export async function isolateBirdSong(
  audioBlob: Blob,
  onProgress?: (progress: number) => void
): Promise<Float32Array> {
  onProgress?.(0.1);
  
  try {
    // Try Hugging Face Inference API first (free tier)
    const result = await callHuggingFaceAPI(audioBlob, onProgress);
    onProgress?.(1.0);
    return result;
  } catch (error) {
    console.error('Hugging Face API failed, trying alternative...', error);
    // Fallback to Replicate or other service
    throw new Error('Source separation API unavailable. Please try again later.');
  }
}

/**
 * Call Hugging Face Inference API for audio source separation
 * Uses facebook/demucs or similar model for source separation
 */
async function callHuggingFaceAPI(
  audioBlob: Blob,
  onProgress?: (progress: number) => void
): Promise<Float32Array> {
  onProgress?.(0.2);
  
  // Use facebook/demucs for source separation (separates into vocals, drums, bass, other)
  // We'll extract the "other" track which should contain bird song
  const model = 'facebook/demucs';
  
  onProgress?.(0.3);
  
  try {
    console.log('Calling audio separation API...');
    
    // Backend proxy URL - REQUIRED for source separation
    // The API key is stored server-side in the backend proxy, NOT in client code
    // See backend-proxy/README.md for deployment instructions
    const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'http://localhost:3000/api/separate-audio';
    
    if (!PROXY_URL) {
      throw new Error('Backend proxy URL not configured. Please set VITE_PROXY_URL environment variable or deploy the backend proxy.');
    }
    
    // Use backend proxy (required - keeps API key secure on server-side)
    const formData = new FormData();
    formData.append('audio', audioBlob, 'audio.wav');
    formData.append('model', model);
    
    const response = await fetch(PROXY_URL, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: `Proxy error: ${response.status}` }));
      throw new Error(errorData.error || `Proxy error: ${response.status}`);
    }
    
    const result = await response.json();
    onProgress?.(0.8);
    
    // Decode base64 audio from proxy response
    const audioData = await base64ToSamples(result.audio, 44100);
    onProgress?.(0.95);
    return audioData;
    
  } catch (error) {
    console.error('Audio separation API error:', error);
    
    // If the model is loading, we might get a 503 error
    if (error instanceof Error && error.message.includes('503')) {
      throw new Error('Model is loading. Please wait 30 seconds and try again.');
    }
    
    // If proxy is not available, provide helpful message
    if (error instanceof Error && (error.message.includes('Failed to fetch') || error.message.includes('CORS'))) {
      throw new Error('CORS error: Please set up the backend proxy. See backend-proxy/README.md for instructions.');
    }
    
    throw error;
  }
}

/**
 * Convert base64 audio string to Float32Array samples
 */
async function base64ToSamples(base64Audio: string, sampleRate: number): Promise<Float32Array> {
  // Decode base64 to ArrayBuffer
  const binaryString = atob(base64Audio);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  // Use AudioContext to decode audio
  const audioContext = new AudioContext({ sampleRate });
  const audioBuffer = await audioContext.decodeAudioData(bytes.buffer);
  
  // Return mono Float32Array
  if (audioBuffer.numberOfChannels === 1) {
    return audioBuffer.getChannelData(0);
  } else {
    // Mix down to mono
    const left = audioBuffer.getChannelData(0);
    const right = audioBuffer.getChannelData(1);
    const mono = new Float32Array(left.length);
    for (let i = 0; i < left.length; i++) {
      mono[i] = (left[i] + right[i]) / 2;
    }
    return mono;
  }
}

/**
 * Convert audio blob to Float32Array samples
 */
async function blobToSamples(audioBlob: Blob): Promise<Float32Array> {
  // Convert blob to ArrayBuffer
  const arrayBuffer = await audioBlob.arrayBuffer();
  
  // Use AudioContext to decode audio (handles WAV, MP3, etc.)
  const audioContext = new AudioContext();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  
  // Return mono Float32Array (mix down if stereo)
  if (audioBuffer.numberOfChannels === 1) {
    return audioBuffer.getChannelData(0);
  } else {
    // Mix down to mono
    const left = audioBuffer.getChannelData(0);
    const right = audioBuffer.getChannelData(1);
    const mono = new Float32Array(left.length);
    for (let i = 0; i < left.length; i++) {
      mono[i] = (left[i] + right[i]) / 2;
    }
    return mono;
  }
}

/**
 * Convert blob to base64 string
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      resolve(base64.split(',')[1]); // Remove data:audio/wav;base64, prefix
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Convert audio samples to WAV blob for API upload
 */
export function samplesToWavBlob(samples: Float32Array, sampleRate: number): Blob {
  const length = samples.length;
  const buffer = new ArrayBuffer(44 + length * 2);
  const view = new DataView(buffer);
  
  // WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, length * 2, true);
  
  // Convert float samples to 16-bit PCM
  let offset = 44;
  for (let i = 0; i < length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    offset += 2;
  }
  
  return new Blob([buffer], { type: 'audio/wav' });
}
