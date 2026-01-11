export interface AudioExtractionResult {
  samples: Float32Array;
  sampleRate: number;
  durationSec: number;
}

export interface VideoMetadata {
  filename: string;
  duration: number;
  size: number;
  type: string;
}

export interface ProcessingProgress {
  stage: string;
  progress: number; // 0-1
}

export type WorkerMessage =
  | { type: 'LOAD_VIDEO'; payload: { file: File } }
  | { type: 'EXTRACT_AUDIO'; payload: { file: File } }
  | { type: 'COMPUTE_SPECTROGRAM'; payload: { samples: Float32Array; sampleRate: number } }
  | { type: 'COMPUTE_MFCC_PCA'; payload: { samples: Float32Array; sampleRate: number } }
  | { type: 'CANCEL' };

export type WorkerResponse =
  | { type: 'PROGRESS'; payload: ProcessingProgress }
  | { type: 'AUDIO_EXTRACTED'; payload: AudioExtractionResult }
  | { type: 'SPECTROGRAM_COMPUTED'; payload: { data: number[][]; sampleRate: number } }
  | { type: 'MFCC_PCA_COMPUTED'; payload: { points: number[][]; mfcc: number[][] } }
  | { type: 'ERROR'; payload: { message: string } };
