import { MelFilterbank } from './melFilterbank';
import { DSP_CONFIG } from './config';

export interface SpectrogramData {
  data: number[][]; // [time][frequency]
  sampleRate: number;
  hopSize: number;
  windowSize: number;
}

/**
 * Compute MFCC features from spectrogram
 */
export function computeMFCC(
  spectrogram: SpectrogramData,
  melFilterbank: MelFilterbank,
  mfccCount: number = DSP_CONFIG.mfccCount
): number[][] {
  const mfccFrames: number[][] = [];

  for (const magnitudeFrame of spectrogram.data) {
    // Convert to Float32Array for mel filterbank
    const magnitudeArray = new Float32Array(magnitudeFrame);

    // Apply mel filterbank
    const melSpectrum = melFilterbank.apply(magnitudeArray);

    // Power spectrum: magnitude^2
    const powerSpectrum = new Float32Array(melSpectrum.length);
    for (let i = 0; i < melSpectrum.length; i++) {
      powerSpectrum[i] = melSpectrum[i] * melSpectrum[i];
    }

    // Log-mel: log10(mel + 1e-10)
    const logMel = new Float32Array(powerSpectrum.length);
    const epsilon = 1e-10;
    for (let i = 0; i < powerSpectrum.length; i++) {
      logMel[i] = Math.log10(powerSpectrum[i] + epsilon);
    }

    // DCT-II (Discrete Cosine Transform)
    const mfcc = dct2(logMel, mfccCount);
    mfccFrames.push(Array.from(mfcc));
  }

  return mfccFrames;
}

/**
 * DCT-II implementation
 */
function dct2(input: Float32Array, count: number): Float32Array {
  const n = input.length;
  const output = new Float32Array(count);

  for (let k = 0; k < count; k++) {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const angle = (Math.PI * k * (i + 0.5)) / n;
      sum += input[i] * Math.cos(angle);
    }
    if (k === 0) {
      output[k] = sum / Math.sqrt(n);
    } else {
      output[k] = sum * Math.sqrt(2.0 / n);
    }
  }

  return output;
}
