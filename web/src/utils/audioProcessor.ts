import { WorkerMessage, WorkerResponse, ProcessingProgress } from '../types';

/**
 * Audio processor utility that manages Web Worker communication
 */
export class AudioProcessor {
  private worker: Worker | null = null;
  private messageId = 0;
  private callbacks: Map<number, {
    onProgress?: (progress: ProcessingProgress) => void;
    onComplete?: (response: WorkerResponse) => void;
    onError?: (error: Error) => void;
  }> = new Map();

  constructor() {
    this.initWorker();
  }

  private initWorker() {
    // Create worker from inline string or use a separate file
    // For Vite, we can import the worker directly
    this.worker = new Worker(
      new URL('../workers/audioProcessor.worker.ts', import.meta.url),
      { type: 'module' }
    );

    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const response = event.data;
      
      if (response.type === 'PROGRESS') {
        // Broadcast progress to all active callbacks
        this.callbacks.forEach(cb => {
          cb.onProgress?.(response.payload);
        });
      } else {
        // Find the callback for this message
        // For now, we'll use the first callback (can be improved with message IDs)
        const callback = Array.from(this.callbacks.values())[0];
        if (callback) {
          if (response.type === 'ERROR') {
            callback.onError?.(new Error(response.payload.message));
          } else {
            callback.onComplete?.(response);
          }
        }
      }
    };

    this.worker.onerror = (error) => {
      this.callbacks.forEach(cb => {
        cb.onError?.(error);
      });
    };
  }

  async computeSpectrogram(
    samples: Float32Array,
    sampleRate: number,
    onProgress?: (progress: ProcessingProgress) => void
  ): Promise<{ data: number[][]; sampleRate: number }> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not initialized'));
        return;
      }

      const id = this.messageId++;
      this.callbacks.set(id, {
        onProgress,
        onComplete: (response) => {
          if (response.type === 'SPECTROGRAM_COMPUTED') {
            resolve(response.payload);
          } else if (response.type === 'ERROR') {
            reject(new Error(response.payload.message));
          }
          this.callbacks.delete(id);
        },
        onError: (error) => {
          reject(error);
          this.callbacks.delete(id);
        },
      });

      const message: WorkerMessage = {
        type: 'COMPUTE_SPECTROGRAM',
        payload: { samples, sampleRate },
      };

      // Note: postMessage will clone the Float32Array
      // For very large arrays, consider using transferable objects
      this.worker.postMessage(message);
    });
  }

  async computeMFCCPCA(
    samples: Float32Array,
    sampleRate: number,
    onProgress?: (progress: ProcessingProgress) => void
  ): Promise<{ points: number[][]; mfcc: number[][] }> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not initialized'));
        return;
      }

      const id = this.messageId++;
      this.callbacks.set(id, {
        onProgress,
        onComplete: (response) => {
          if (response.type === 'MFCC_PCA_COMPUTED') {
            resolve(response.payload);
          } else if (response.type === 'ERROR') {
            reject(new Error(response.payload.message));
          }
          this.callbacks.delete(id);
        },
        onError: (error) => {
          reject(error);
          this.callbacks.delete(id);
        },
      });

      const message: WorkerMessage = {
        type: 'COMPUTE_MFCC_PCA',
        payload: { samples, sampleRate },
      };

      this.worker.postMessage(message);
    });
  }

  cancel() {
    if (this.worker) {
      this.worker.postMessage({ type: 'CANCEL' } as WorkerMessage);
    }
    this.callbacks.clear();
  }

  terminate() {
    this.worker?.terminate();
    this.worker = null;
    this.callbacks.clear();
  }
}
