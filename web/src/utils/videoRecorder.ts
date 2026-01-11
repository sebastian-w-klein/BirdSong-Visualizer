/**
 * Video recording utility for capturing Three.js scenes and compositing with video
 */

import * as THREE from 'three';

export interface RecordingOptions {
  width: number;
  height: number;
  fps: number;
  duration: number; // in seconds
}

export interface FrameCapture {
  canvas: HTMLCanvasElement;
  timestamp: number;
}

/**
 * Capture frames from a Three.js renderer
 */
export class ManifoldVideoRecorder {
  private frames: ImageData[] = [];
  private isRecording = false;
  private startTime = 0;
  private frameInterval = 0;
  private captureCallback: (() => void) | null = null;

  /**
   * Start recording frames from Three.js renderer
   */
  startRecording(
    renderer: THREE.WebGLRenderer,
    options: RecordingOptions,
    onFrame?: (frameNumber: number, totalFrames: number) => void
  ) {
    this.frames = [];
    this.isRecording = true;
    this.startTime = performance.now();
    this.frameInterval = 1000 / options.fps;

    const totalFrames = Math.floor(options.duration * options.fps);
    let frameCount = 0;
    let lastNotifiedFrame = -1;

    this.captureCallback = () => {
      if (!this.isRecording) {
        return;
      }

      const currentTime = performance.now();
      const elapsed = currentTime - this.startTime;
      const expectedFrame = Math.floor(elapsed / this.frameInterval);

      // Notify about frame BEFORE capturing so camera can update
      if (expectedFrame > lastNotifiedFrame && expectedFrame <= totalFrames) {
        onFrame?.(expectedFrame, totalFrames);
        lastNotifiedFrame = expectedFrame;
      }

      // Capture frame if we're at the right time
      // Small delay ensures camera update from onFrame callback completes
      if (expectedFrame >= frameCount && frameCount < totalFrames) {
        // Use setTimeout to allow camera update to complete
        setTimeout(() => {
          if (this.isRecording && frameCount < totalFrames) {
            const canvas = renderer.domElement;
            const imageData = this.captureCanvasFrame(canvas);
            this.frames.push(imageData);
            frameCount++;
          }
        }, 20); // Small delay to ensure camera update
      }

      // Stop recording when all frames are captured
      if (frameCount >= totalFrames) {
        this.isRecording = false;
        this.captureCallback = null; // Clear callback to signal completion
      }
    };
  }

  /**
   * Stop recording
   */
  stopRecording(): ImageData[] {
    this.isRecording = false;
    return this.frames;
  }

  /**
   * Capture a single frame from canvas (WebGL renderer)
   */
  private captureCanvasFrame(canvas: HTMLCanvasElement): ImageData {
    // For WebGL renderer, read pixels directly
    const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');
    if (gl) {
      const pixels = new Uint8Array(canvas.width * canvas.height * 4);
      gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      // Flip vertically (WebGL has origin at bottom-left, ImageData has top-left)
      const flipped = new Uint8Array(pixels.length);
      for (let y = 0; y < canvas.height; y++) {
        const srcY = canvas.height - 1 - y;
        for (let x = 0; x < canvas.width; x++) {
          const srcIdx = (srcY * canvas.width + x) * 4;
          const dstIdx = (y * canvas.width + x) * 4;
          flipped[dstIdx] = pixels[srcIdx];
          flipped[dstIdx + 1] = pixels[srcIdx + 1];
          flipped[dstIdx + 2] = pixels[srcIdx + 2];
          flipped[dstIdx + 3] = pixels[srcIdx + 3];
        }
      }
      return new ImageData(
        new Uint8ClampedArray(flipped),
        canvas.width,
        canvas.height
      );
    }
    // Fallback: try 2D context
    const ctx = canvas.getContext('2d');
    if (ctx) {
      return ctx.getImageData(0, 0, canvas.width, canvas.height);
    }
    throw new Error('Unable to capture canvas frame');
  }

  /**
   * Get capture callback to call in render loop
   */
  getCaptureCallback(): (() => void) | null {
    return this.captureCallback;
  }

  /**
   * Encode frames to video using ffmpeg.wasm
   */
  async encodeToVideo(
    frames: ImageData[],
    options: RecordingOptions,
    onProgress?: (progress: number) => void
  ): Promise<Blob> {
    const { FFmpeg } = await import('@ffmpeg/ffmpeg');
    const { fetchFile, toBlobURL } = await import('@ffmpeg/util');

    const ffmpeg = new FFmpeg();
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

    onProgress?.(5);

    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });

    onProgress?.(10);

    // Convert ImageData frames to PNG files
    const totalFrames = frames.length;
    for (let i = 0; i < frames.length; i++) {
      const canvas = document.createElement('canvas');
      canvas.width = options.width;
      canvas.height = options.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.putImageData(frames[i], 0, 0);
        const blob = await new Promise<Blob>((resolve) => {
          canvas.toBlob((blob) => resolve(blob!), 'image/png');
        });
        const filename = `frame${String(i).padStart(6, '0')}.png`;
        await ffmpeg.writeFile(filename, await fetchFile(blob));
      }
      // Report progress: 10-60% for frame conversion
      if (i % 10 === 0 || i === totalFrames - 1) {
        onProgress?.(10 + (i / totalFrames) * 50);
      }
    }

    onProgress?.(60);
    console.log(`Creating video from ${totalFrames} frames at ${options.fps} fps...`);
    console.log(`This may take 1-3 minutes for ${totalFrames} frames...`);

    // Create video from frames with timeout protection
    const outputName = 'output.mp4';
    try {
      const execPromise = ffmpeg.exec([
        '-framerate', String(options.fps),
        '-i', 'frame%06d.png',
        '-c:v', 'libx264',
        '-preset', 'ultrafast', // Fast encoding
        '-crf', '28', // Slightly lower quality for speed
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart', // Web optimization
        '-y',
        outputName,
      ]);

      // Add timeout (5 minutes max for encoding)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Video encoding timeout (exceeded 5 minutes). Processing ${totalFrames} frames may be too slow.`));
        }, 5 * 60 * 1000);
      });

      await Promise.race([execPromise, timeoutPromise]);
      console.log('Video encoding complete');
    } catch (error) {
      console.error('Error during video encoding:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      if (errorMsg.includes('timeout')) {
        throw new Error(`Video encoding is taking too long for ${totalFrames} frames. Try a shorter video clip or lower frame rate.`);
      }
      throw new Error(`Failed to encode video: ${errorMsg}`);
    }

    onProgress?.(95);

    const videoData = await ffmpeg.readFile(outputName);
    const videoBlob = new Blob([videoData], { type: 'video/mp4' });

    await ffmpeg.terminate();

    return videoBlob;
  }

  /**
   * Create split-screen video (manifold + original video)
   */
  async createSplitScreenVideo(
    manifoldFrames: ImageData[],
    videoFile: File,
    options: RecordingOptions,
    onProgress?: (progress: number, status?: string) => void
  ): Promise<Blob> {
    const { FFmpeg } = await import('@ffmpeg/ffmpeg');
    const { fetchFile, toBlobURL } = await import('@ffmpeg/util');

    const ffmpeg = new FFmpeg();
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

    onProgress?.(5, 'Loading ffmpeg...');

    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });

    console.log('ffmpeg loaded successfully');
    onProgress?.(10, 'Writing input video...');

    // Write input video
    const inputName = 'input.' + videoFile.name.split('.').pop();
    await ffmpeg.writeFile(inputName, await fetchFile(videoFile));
    console.log('Input video written to ffmpeg');
    
    onProgress?.(15, 'Converting manifold frames to images...');

    // Convert manifold frames to images
    const totalFrames = manifoldFrames.length;
    for (let i = 0; i < manifoldFrames.length; i++) {
      const canvas = document.createElement('canvas');
      canvas.width = options.width / 2; // Half width for split screen
      canvas.height = options.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.putImageData(manifoldFrames[i], 0, 0);
        const blob = await new Promise<Blob>((resolve) => {
          canvas.toBlob((blob) => resolve(blob!), 'image/png');
        });
        const filename = `manifold${String(i).padStart(6, '0')}.png`;
        await ffmpeg.writeFile(filename, await fetchFile(blob));
      }
      // Report progress: 15-35% for frame conversion
      if (i % 10 === 0 || i === totalFrames - 1) {
        onProgress?.(15 + (i / totalFrames) * 20, `Converting frames... ${i + 1}/${totalFrames}`);
      }
    }

    console.log(`Converted ${totalFrames} manifold frames to images`);
    onProgress?.(35, 'Creating manifold video...');

    // Create video from manifold frames
    try {
      console.log(`Creating manifold video from ${totalFrames} frames at ${options.fps} fps`);
      await ffmpeg.exec([
        '-framerate', String(options.fps),
        '-i', 'manifold%06d.png',
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-y',
        'manifold.mp4',
      ]);
      console.log('Manifold video created successfully');
    } catch (error) {
      console.error('Error creating manifold video:', error);
      throw new Error(`Failed to create manifold video: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    onProgress?.(55, 'Processing original video (this may take 1-2 minutes)...');

    // Resize and trim input video to match
    try {
      console.log(`Resizing video: scale=${options.width / 2}:${options.height}, duration=${options.duration}`);
      
      // Check if input file exists
      const files = await ffmpeg.listDir('/');
      const fileExists = files.some(f => f.name === inputName);
      console.log(`Input file: ${inputName}, exists: ${fileExists}`);
      
      if (!fileExists) {
        throw new Error(`Input video file ${inputName} not found in ffmpeg filesystem`);
      }

      // Use simplest possible approach with timeout protection
      console.log(`Starting video processing for ${options.duration}s clip (this may take 1-2 minutes)...`);
      
      // Create exec promise
      const execPromise = ffmpeg.exec([
        '-i', inputName,
        '-t', String(options.duration),
        '-vf', `scale=${options.width / 2}:${options.height}`,
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '28',
        '-pix_fmt', 'yuv420p',
        '-an',
        '-movflags', '+faststart',
        '-y',
        'video_resized.mp4',
      ]);

      // Add timeout (3 minutes max for video processing)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Video processing timeout (exceeded 3 minutes). Video may be too large or complex.'));
        }, 3 * 60 * 1000);
      });

      await Promise.race([execPromise, timeoutPromise]);
      console.log('Original video resized and trimmed successfully');
    } catch (error) {
      console.error('Error resizing video:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      
      // If timeout, provide helpful message
      if (errorMsg.includes('timeout')) {
        throw new Error('Video processing is taking too long. Try a shorter video clip (under 30 seconds) or lower resolution.');
      }
      
      throw new Error(`Failed to resize original video: ${errorMsg}`);
    }

    onProgress?.(75, 'Compositing split-screen video...');

    // Composite split-screen video
    console.log('Starting split-screen composition...');
    try {
      await ffmpeg.exec([
        '-i', 'manifold.mp4',
        '-i', 'video_resized.mp4',
        '-filter_complex', `[0:v][1:v]hstack=inputs=2[v]`,
        '-map', '[v]',
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-y',
        'output.mp4',
      ]);
      console.log('Split-screen composition completed');
    } catch (error) {
      console.error('Error during split-screen composition:', error);
      throw new Error(`Failed to composite split-screen video: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    console.log('Split-screen video composited');
    onProgress?.(95, 'Finalizing...');

    try {
      const videoData = await ffmpeg.readFile('output.mp4');
      console.log(`Video file size: ${videoData.length} bytes`);
      const videoBlob = new Blob([videoData], { type: 'video/mp4' });
      
      onProgress?.(98, 'Cleaning up...');
      await ffmpeg.terminate();
      console.log('ffmpeg terminated successfully');

      onProgress?.(100, 'Complete!');
      return videoBlob;
    } catch (error) {
      console.error('Error reading output video:', error);
      // Try to list files to see what's available
      try {
        const files = await ffmpeg.listDir('/');
        console.log('Files in ffmpeg filesystem:', files);
      } catch (listError) {
        console.error('Error listing files:', listError);
      }
      throw error;
    }
  }
}
