import { hannWindow, applyWindow } from './windowing';
import { computeFFT, magnitudeSpectrum } from './fft';
import { DSP_CONFIG } from './config';

export interface SpectrogramResult {
  data: number[][]; // [time][frequency] - magnitude values
  sampleRate: number;
  hopSize: number;
  windowSize: number;
  nFrames: number;
  nBins: number;
}

/**
 * Compute STFT spectrogram from audio samples
 */
export function computeSpectrogram(
  samples: Float32Array,
  sampleRate: number,
  windowSize: number = DSP_CONFIG.windowSize,
  hopSize: number = DSP_CONFIG.hopSize,
  maxFrames: number = DSP_CONFIG.maxFrames
): SpectrogramResult {
  // Pre-emphasis filter
  const preEmphasized = new Float32Array(samples.length);
  preEmphasized[0] = samples[0];
  for (let i = 1; i < samples.length; i++) {
    preEmphasized[i] = samples[i] - DSP_CONFIG.preEmphasisCoeff * samples[i - 1];
  }
  
  // Calculate number of frames
  const nFrames = Math.min(
    maxFrames,
    Math.floor((preEmphasized.length - windowSize) / hopSize) + 1
  );
  
  // Create window
  const window = hannWindow(windowSize);
  
  // Zero-pad to next power of 2 for FFT
  const fftSize = Math.pow(2, Math.ceil(Math.log2(windowSize)));
  
  // Compute spectrogram
  const spectrogram: number[][] = [];
  
  for (let frameIdx = 0; frameIdx < nFrames; frameIdx++) {
    const start = frameIdx * hopSize;
    if (start + windowSize > preEmphasized.length) break;
    
    // Extract frame
    const frame = preEmphasized.slice(start, start + windowSize);
    
    // Apply window
    const windowed = applyWindow(frame, window);
    
    // Zero-pad to fftSize
    const padded = new Float32Array(fftSize);
    padded.set(windowed);
    
    // Compute FFT
    const fftResult = computeFFT(padded, fftSize);
    
    // Get magnitude spectrum (only need first half + DC)
    const magnitude = magnitudeSpectrum(fftResult);
    const nBins = Math.floor(fftSize / 2) + 1;
    const frameMagnitude = Array.from(magnitude.slice(0, nBins));
    
    spectrogram.push(frameMagnitude);
  }
  
  return {
    data: spectrogram,
    sampleRate,
    hopSize,
    windowSize,
    nFrames: spectrogram.length,
    nBins: spectrogram[0]?.length || 0,
  };
}
