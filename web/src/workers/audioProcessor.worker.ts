import { computeSpectrogram } from '../dsp/spectrogram';
import { MelFilterbank } from '../dsp/melFilterbank';
import { computeMFCC } from '../dsp/mfcc';
import { computePCA3D } from '../dsp/pca';
import { WorkerMessage, WorkerResponse } from '../types';

/**
 * Web Worker for audio processing
 * Handles heavy DSP computations off the main thread
 */

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;
  
  switch (message.type) {
    case 'COMPUTE_SPECTROGRAM': {
      const { samples, sampleRate } = message.payload;
      
      try {
        // Send progress update
        self.postMessage({
          type: 'PROGRESS',
          payload: { stage: 'Computing spectrogram', progress: 0.1 },
        } as WorkerResponse);
        
        // Compute spectrogram
        const result = computeSpectrogram(samples, sampleRate);
        
        // Send progress update
        self.postMessage({
          type: 'PROGRESS',
          payload: { stage: 'Computing spectrogram', progress: 0.9 },
        } as WorkerResponse);
        
        // Send result
        self.postMessage({
          type: 'SPECTROGRAM_COMPUTED',
          payload: {
            data: result.data,
            sampleRate: result.sampleRate,
          },
        } as WorkerResponse);
      } catch (error) {
        self.postMessage({
          type: 'ERROR',
          payload: {
            message: error instanceof Error ? error.message : 'Unknown error computing spectrogram',
          },
        } as WorkerResponse);
      }
      break;
    }
    
    case 'COMPUTE_MFCC_PCA': {
      const { samples, sampleRate } = message.payload;
      
      try {
        // Step 1: Compute spectrogram
        self.postMessage({
          type: 'PROGRESS',
          payload: { stage: 'Computing spectrogram', progress: 0.1 },
        } as WorkerResponse);
        
        const spectrogram = computeSpectrogram(samples, sampleRate);
        
        // Step 2: Compute mel filterbank
        self.postMessage({
          type: 'PROGRESS',
          payload: { stage: 'Computing mel features', progress: 0.3 },
        } as WorkerResponse);
        
        const fftSize = spectrogram.data[0]?.length ? (spectrogram.data[0].length - 1) * 2 : 2048;
        const melFilterbank = new MelFilterbank(sampleRate, fftSize);
        
        // Step 3: Compute MFCC
        self.postMessage({
          type: 'PROGRESS',
          payload: { stage: 'Computing MFCC', progress: 0.5 },
        } as WorkerResponse);
        
        const mfcc = computeMFCC(spectrogram, melFilterbank);
        
        // Step 4: Compute PCA
        self.postMessage({
          type: 'PROGRESS',
          payload: { stage: 'Computing PCA', progress: 0.8 },
        } as WorkerResponse);
        
        const pcaPoints = computePCA3D(mfcc);
        
        // Send result
        self.postMessage({
          type: 'MFCC_PCA_COMPUTED',
          payload: {
            points: pcaPoints,
            mfcc: mfcc,
          },
        } as WorkerResponse);
      } catch (error) {
        self.postMessage({
          type: 'ERROR',
          payload: {
            message: error instanceof Error ? error.message : 'Unknown error computing MFCC/PCA',
          },
        } as WorkerResponse);
      }
      break;
    }
    
    case 'CANCEL': {
      // Worker can be terminated if needed
      break;
    }
    
    default:
      self.postMessage({
        type: 'ERROR',
        payload: { message: `Unknown message type: ${(message as any).type}` },
      } as WorkerResponse);
  }
};
