import { AudioExtractionResult } from '../types';

/**
 * Attempts native audio extraction from video file using MediaRecorder API
 * This works by playing the video and capturing the audio stream
 * Returns null if native extraction fails or is not supported
 */
export async function extractAudioNative(file: File): Promise<AudioExtractionResult | null> {
  try {
    // Check if MediaRecorder is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return null;
    }

    // Create video element with blob URL
    const videoUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.src = videoUrl;
    video.muted = false; // Need audio for capture
    video.preload = 'auto';
    video.crossOrigin = 'anonymous';
    
    // Wait for video to be ready
    await new Promise<void>((resolve, reject) => {
      video.oncanplaythrough = () => resolve();
      video.onerror = () => reject(new Error('Failed to load video'));
      video.load();
    });

    const duration = video.duration;
    if (!isFinite(duration) || duration <= 0) {
      URL.revokeObjectURL(videoUrl);
      return null;
    }

    // Try to capture audio using MediaRecorder
    // This requires the video to play, which may not work for all codecs
    // Note: MediaElementSource approach has limitations on mobile Safari
    // We'll fall back to ffmpeg.wasm for reliability
    
    // For now, native extraction is unreliable on mobile
    // We'll return null to use ffmpeg fallback
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    URL.revokeObjectURL(videoUrl);
    audioContext.close();
    
    // On mobile Safari, native extraction is very limited
    // Always fall back to ffmpeg for reliability
    return null;
    
  } catch (error) {
    console.warn('Native audio extraction failed:', error);
    return null;
  }
}

/**
 * Extracts audio using ffmpeg.wasm
 * This is the fallback method when native extraction fails
 */
export async function extractAudioFFmpeg(file: File): Promise<AudioExtractionResult> {
  // Lazy load ffmpeg
  const { FFmpeg } = await import('@ffmpeg/ffmpeg');
  const { fetchFile, toBlobURL } = await import('@ffmpeg/util');
  
  const ffmpeg = new FFmpeg();
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
  
  // Load ffmpeg core
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });
  
  // Write input file
  const inputName = 'input.' + file.name.split('.').pop();
  await ffmpeg.writeFile(inputName, await fetchFile(file));
  
  // Extract audio to WAV
  const outputName = 'output.wav';
  await ffmpeg.exec([
    '-i', inputName,
    '-vn', // No video
    '-acodec', 'pcm_s16le', // PCM 16-bit little-endian
    '-ar', '44100', // Sample rate
    '-ac', '1', // Mono
    outputName
  ]);
  
  // Read output WAV
  const wavData = await ffmpeg.readFile(outputName);
  const wavBlob = new Blob([wavData as BlobPart], { type: 'audio/wav' });
  
  // Decode WAV to Float32Array
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const arrayBuffer = await wavBlob.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  
  // Convert to mono Float32Array
  const samples = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  const durationSec = audioBuffer.duration;
  
  await ffmpeg.terminate();
  
  return {
    samples,
    sampleRate,
    durationSec
  };
}

/**
 * Main extraction function: tries native first, falls back to ffmpeg
 */
export async function extractAudio(
  file: File,
  onProgress?: (progress: number) => void
): Promise<AudioExtractionResult> {
  onProgress?.(0.1);
  
  // Try native extraction first
  const nativeResult = await extractAudioNative(file);
  if (nativeResult) {
    onProgress?.(1.0);
    return nativeResult;
  }
  
  onProgress?.(0.2);
  
  // Fall back to ffmpeg
  console.log('Native extraction failed, using ffmpeg.wasm fallback');
  const ffmpegResult = await extractAudioFFmpeg(file);
  onProgress?.(1.0);
  
  return ffmpegResult;
}
