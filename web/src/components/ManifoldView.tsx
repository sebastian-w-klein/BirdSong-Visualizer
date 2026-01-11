import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { ManifoldVideoRecorder, RecordingOptions } from '../utils/videoRecorder';

interface ManifoldViewProps {
  points: number[][]; // Array of [x, y, z] points
  spectrogramData?: number[][]; // Optional: for frequency labels
  sampleRate?: number; // Optional: for frequency calculation
  originalVideoFile?: File; // Optional: for split-screen export
  audioSamples?: Float32Array; // Optional: audio samples for playback
  audioSampleRate?: number; // Optional: audio sample rate
  width?: number;
  height?: number;
}

/**
 * 3D manifold visualization using Three.js
 * Displays the PCA-reduced trajectory of bird song features
 * With real-time animation and frequency labels
 */
export const ManifoldView: React.FC<ManifoldViewProps> = ({
  points,
  spectrogramData,
  sampleRate,
  originalVideoFile,
  audioSamples,
  audioSampleRate,
  width = 800,
  height = 400,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    trajectory?: THREE.Line;
    animatedLine?: THREE.Line;
    currentPoint?: THREE.Mesh;
    labels?: THREE.Group;
  } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1); // 1x, 2x, 0.5x, etc.
  const [isRecording, setIsRecording] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [recordingStatus, setRecordingStatus] = useState<string>('');
  const [recordingStartTime, setRecordingStartTime] = useState<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const isPlayingRef = useRef(false);
  const currentFrameRef = useRef(0);
  const speedRef = useRef(1);
  const recorderRef = useRef<ManifoldVideoRecorder | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const recordingOptionsRef = useRef<RecordingOptions | null>(null);
  const recordingFrameRef = useRef<number>(0); // Track actual recording frame number
  const smoothedCameraPosRef = useRef<THREE.Vector3 | null>(null); // For exponential smoothing
  const smoothedDirectionRef = useRef<THREE.Vector3 | null>(null); // For exponential smoothing
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioStartTimeRef = useRef<number>(0);
  const audioPausedTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!containerRef.current || points.length === 0) return;

    // Initialize Three.js scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(0, 0, 5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(width, height);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Add lights
    const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    // Normalize points for display
    const normalized = normalizePoints(points);

    // Create full trajectory line (gray, semi-transparent)
    const fullTrajectory = createTrajectory(normalized, 0x666666, 0.3);
    scene.add(fullTrajectory);

    // Create animated trajectory line with gradient colors
    const animatedTrajectory = createGradientTrajectory([], normalized.length);
    scene.add(animatedTrajectory);

    // Create current point indicator
    const currentPointGeometry = new THREE.SphereGeometry(0.05, 16, 16);
    const currentPointMaterial = new THREE.MeshPhongMaterial({
      color: 0xff0000,
      emissive: 0xff0000,
    });
    const currentPoint = new THREE.Mesh(currentPointGeometry, currentPointMaterial);
    scene.add(currentPoint);

    // Create labels group
    const labelsGroup = new THREE.Group();
    scene.add(labelsGroup);

    // Add point sprites (sample every Nth point)
    const stride = Math.max(1, Math.floor(points.length / 50));
    for (let i = 0; i < normalized.length; i += stride) {
      const point = normalized[i];
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.015, 8, 8),
        new THREE.MeshPhongMaterial({
          color: getColorForIndex(i, normalized.length),
          emissive: getColorForIndex(i, normalized.length),
          transparent: true,
          opacity: 0.6,
        })
      );
      sphere.position.set(point[0], point[1], point[2]);
      scene.add(sphere);

      // Add frequency label if spectrogram data is available
      // Show labels less frequently to avoid clutter
      if (spectrogramData && sampleRate && i % (stride * 4) === 0) {
        const label = createFrequencyLabel(
          spectrogramData[i],
          sampleRate,
          i,
          normalized.length
        );
        if (label) {
          // Position label above the point
          label.position.set(point[0], point[1] + 0.15, point[2]);
          labelsGroup.add(label);
        }
      }
    }

    // Add orbit controls
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;

      camera.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), deltaX * 0.01);
      camera.position.applyAxisAngle(new THREE.Vector3(1, 0, 0), deltaY * 0.01);
      camera.lookAt(0, 0, 0);

      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const scale = e.deltaY > 0 ? 1.1 : 0.9;
      camera.position.multiplyScalar(scale);
      camera.lookAt(0, 0, 0);
    };

    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mouseup', onMouseUp);
    renderer.domElement.addEventListener('wheel', onWheel);

    // Animation function
    const animateTrajectory = (frame: number) => {
      if (frame >= normalized.length) {
        isPlayingRef.current = false;
        setIsPlaying(false);
        return;
      }

      // Update animated line with gradient colors
      const animatedPoints = normalized.slice(0, frame + 1);
      const animatedGeometry = createGradientTrajectoryGeometry(animatedPoints, normalized.length);
      animatedTrajectory.geometry.dispose();
      animatedTrajectory.geometry = animatedGeometry;

      // Update current point position
      if (frame < normalized.length) {
        const point = normalized[frame];
        currentPoint.position.set(point[0], point[1], point[2]);
        currentPoint.visible = true;
      }

      currentFrameRef.current = frame;
      setCurrentFrame(frame);
    };

    // Initialize animation state
    isPlayingRef.current = isPlaying;
    currentFrameRef.current = currentFrame;
    animateTrajectory(currentFrame);

    // Animation loop
    const animate = (time: number) => {
      animationFrameRef.current = requestAnimationFrame(animate);

      if (isPlayingRef.current) {
        const deltaTime = time - lastTimeRef.current;
        // Animate at ~30 frames per second, adjusted by playback speed
        const frameInterval = 33 / speedRef.current;
        if (deltaTime > frameInterval) {
          const framesToAdvance = Math.floor(deltaTime / frameInterval);
          const nextFrame = Math.min(
            currentFrameRef.current + framesToAdvance,
            normalized.length - 1
          );
          if (nextFrame < normalized.length) {
            animateTrajectory(nextFrame);
            lastTimeRef.current = time;
          } else {
            isPlayingRef.current = false;
            setIsPlaying(false);
          }
        }
      }

      // During recording, camera is updated in the onFrame callback
      // The render loop should NOT update the camera during recording
      // because the callback handles it with precise timing
      // This prevents the render loop from overwriting the camera position

      renderer.render(scene, camera);

      // Capture frame if recording
      if (recorderRef.current) {
        const captureCallback = recorderRef.current.getCaptureCallback();
        captureCallback?.();
      }
    };
    animate(0);

    sceneRef.current = {
      scene,
      camera,
      renderer,
      trajectory: fullTrajectory,
      animatedLine: animatedTrajectory,
      currentPoint,
      labels: labelsGroup,
    };

    // Cleanup
    return () => {
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      renderer.domElement.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('mouseup', onMouseUp);
      renderer.domElement.removeEventListener('wheel', onWheel);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      renderer.dispose();
      if (containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, [points, spectrogramData, sampleRate, width, height]);

  // Start audio playback
  const startAudioPlayback = () => {
    if (!audioBufferRef.current || !audioContextRef.current || !audioSamples || !audioSampleRate) return;

    try {
      const audioContext = audioContextRef.current;

      // Resume audio context if suspended (required by some browsers)
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }

      // Stop any existing audio source
      if (audioSourceRef.current) {
        try {
          audioSourceRef.current.stop();
        } catch (e) {
          // Ignore errors
        }
        audioSourceRef.current = null;
      }

      // Create new audio source
      const source = audioContext.createBufferSource();
      source.buffer = audioBufferRef.current;
      source.playbackRate.value = playbackSpeed;
      
      // Calculate start offset based on current frame
      // Map current frame to audio time position
      const totalFrames = points.length;
      const audioDuration = audioBufferRef.current.duration;
      const audioStartOffset = (currentFrame / totalFrames) * audioDuration;
      const clampedOffset = Math.max(0, Math.min(audioStartOffset, audioDuration));

      // Connect to destination
      source.connect(audioContext.destination);
      
      // Start playback from the calculated offset
      source.start(0, clampedOffset);
      audioStartTimeRef.current = audioContext.currentTime;
      audioPausedTimeRef.current = clampedOffset;
      
      audioSourceRef.current = source;

      // Handle audio end
      source.onended = () => {
        if (isPlayingRef.current) {
          setIsPlaying(false);
          isPlayingRef.current = false;
        }
        audioSourceRef.current = null;
        audioPausedTimeRef.current = 0;
      };
    } catch (err) {
      console.warn('Failed to start audio playback:', err);
    }
  };

  // Pause audio playback
  const pauseAudioPlayback = () => {
    if (audioSourceRef.current && audioContextRef.current && audioBufferRef.current) {
      try {
        const audioContext = audioContextRef.current;
        // Calculate how much time has elapsed since start
        const elapsed = audioContext.currentTime - audioStartTimeRef.current;
        // Update paused time to current position
        audioPausedTimeRef.current += elapsed * playbackSpeed;
        audioSourceRef.current.stop();
        audioSourceRef.current = null;
      } catch (err) {
        console.warn('Failed to pause audio playback:', err);
      }
    }
  };

  // Handle play/pause state changes and sync audio
  useEffect(() => {
    isPlayingRef.current = isPlaying;
    if (isPlaying) {
      lastTimeRef.current = performance.now();
      // Start audio playback
      startAudioPlayback();
    } else {
      // Pause audio playback
      pauseAudioPlayback();
    }
  }, [isPlaying]);

  // Handle playback speed changes
  useEffect(() => {
    speedRef.current = playbackSpeed;
    // Update audio playback rate if audio is playing
    if (audioSourceRef.current && audioContextRef.current) {
      audioSourceRef.current.playbackRate.value = playbackSpeed;
    }
  }, [playbackSpeed]);

  // Initialize audio when samples are available
  useEffect(() => {
    if (audioSamples && audioSampleRate && points.length > 0) {
      const initAudio = async () => {
        try {
          // Create or get audio context
          if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
          }
          const audioContext = audioContextRef.current;

          // Create audio buffer from samples
          const buffer = audioContext.createBuffer(1, audioSamples.length, audioSampleRate);
          const channelData = buffer.getChannelData(0);
          channelData.set(audioSamples);
          audioBufferRef.current = buffer;
        } catch (err) {
          console.warn('Failed to initialize audio:', err);
        }
      };
      initAudio();
    }

    // Cleanup on unmount
    return () => {
      if (audioSourceRef.current) {
        try {
          audioSourceRef.current.stop();
        } catch (e) {
          // Ignore errors when stopping
        }
        audioSourceRef.current = null;
      }
    };
  }, [audioSamples, audioSampleRate, points.length]);

  // Handle currentFrame changes from controls
  useEffect(() => {
    if (sceneRef.current && points.length > 0) {
      const normalized = normalizePoints(points);
      if (currentFrame < normalized.length) {
        const animatedPoints = normalized.slice(0, currentFrame + 1);
        const animatedGeometry = createGradientTrajectoryGeometry(animatedPoints, normalized.length);
        sceneRef.current.animatedLine!.geometry.dispose();
        sceneRef.current.animatedLine!.geometry = animatedGeometry;

        const point = normalized[currentFrame];
        sceneRef.current.currentPoint!.position.set(point[0], point[1], point[2]);
        sceneRef.current.currentPoint!.visible = true;
      }
      currentFrameRef.current = currentFrame;
    }
  }, [currentFrame, points]);

  const handlePlayPause = () => {
    if (isRecording) return; // Disable during recording
    const newState = !isPlaying;
    setIsPlaying(newState);
    isPlayingRef.current = newState;
    if (newState) {
      lastTimeRef.current = performance.now();
    }
  };

  const handleReset = () => {
    setIsPlaying(false);
    isPlayingRef.current = false;
    setCurrentFrame(0);
    currentFrameRef.current = 0;
    // Stop and reset audio
    pauseAudioPlayback();
    audioPausedTimeRef.current = 0;
  };

  const handleDownloadManifoldVideo = async () => {
    if (!rendererRef.current || points.length === 0) return;

    setIsRecording(true);
    setRecordingProgress(0);
    setRecordingStatus('Preparing recording...');
    setRecordingStartTime(performance.now());

    try {
      const recorder = new ManifoldVideoRecorder();
      recorderRef.current = recorder;

      // Calculate duration from points (assuming ~30fps for original)
      const baseDuration = points.length / 30; // Approximate duration
      // Removed revolution - it wasn't working reliably
      const options: RecordingOptions = {
        width,
        height,
        fps: 30,
        duration: Math.min(baseDuration, 60), // Cap at 60 seconds
      };
      recordingOptionsRef.current = options;

      // Reset to start
      setIsPlaying(false);
      setCurrentFrame(0);
      currentFrameRef.current = 0;
      
      if (sceneRef.current) {
        const normalized = normalizePoints(points);
        // Initialize camera to follow first point
        if (normalized.length > 0) {
          const firstPoint = normalized[0];
          sceneRef.current.camera.position.set(
            firstPoint[0],
            firstPoint[1],
            firstPoint[2] + 2.5 // Zoomed out
          );
          sceneRef.current.camera.lookAt(firstPoint[0], firstPoint[1], firstPoint[2]);
        }
      }

      setRecordingStatus('Capturing frames...');

      // Start recording
      recordingFrameRef.current = 0;
      recorder.startRecording(rendererRef.current, options, (frame, total) => {
        // Update recording frame FIRST
        recordingFrameRef.current = frame;
        
        // Update progress
        setRecordingProgress((frame / total) * 50);
        setRecordingStatus(`Capturing frames... ${frame}/${total}`);
        
        // Advance animation during recording
        const normalized = normalizePoints(points);
        // Simple linear progression through all points
        const targetFrame = Math.floor((frame / total) * points.length);
        if (targetFrame < points.length) {
          currentFrameRef.current = targetFrame;
          setCurrentFrame(targetFrame);
        } else {
          currentFrameRef.current = points.length - 1;
          setCurrentFrame(points.length - 1);
        }
        
        // Reset smoothing refs when starting a new recording
        if (frame === 1) {
          smoothedCameraPosRef.current = null;
          smoothedDirectionRef.current = null;
        }
        
        // CRITICAL: Update camera immediately when frame changes
        // This must happen BEFORE the frame is captured
        if (sceneRef.current && normalized.length > 0) {
          updateCameraForRecording(
            sceneRef.current.camera,
            normalized,
            currentFrameRef.current,
            recordingFrameRef.current,
            normalized.length,
            options,
            smoothedCameraPosRef,
            smoothedDirectionRef
          );
          // Force immediate camera update
          sceneRef.current.camera.updateMatrixWorld();
          // Re-render with new camera position before frame capture
          sceneRef.current.renderer.render(sceneRef.current.scene, sceneRef.current.camera);
        }
      });

      // Wait for recording to complete
      await new Promise((resolve) => {
        const checkComplete = setInterval(() => {
          const callback = recorderRef.current?.getCaptureCallback();
          if (!recorderRef.current || !callback) {
            clearInterval(checkComplete);
            resolve(null);
          }
        }, 100);
        // Safety timeout: wait a bit longer than expected duration
        setTimeout(() => {
          clearInterval(checkComplete);
          if (recorderRef.current) {
            recorderRef.current.stopRecording();
          }
          resolve(null);
        }, (options.duration + 5) * 1000);
      });

      const frames = recorder.stopRecording();
      console.log(`Captured ${frames.length} frames for manifold video`);
      setRecordingProgress(50);
      const estimatedTime = Math.ceil(frames.length / 30 / 60); // Rough estimate in minutes
      setRecordingStatus(`Encoding video (${frames.length} frames, ~${estimatedTime} min)...`);

      // Encode to video with progress
      const videoBlob = await recorder.encodeToVideo(frames, options, (progress) => {
        setRecordingProgress(50 + (progress / 100) * 50);
        if (progress < 60) {
          setRecordingStatus(`Converting frames to images... ${Math.round(progress)}%`);
        } else if (progress < 95) {
          setRecordingStatus(`Encoding video from ${frames.length} frames... ${Math.round(progress)}%`);
        } else {
          setRecordingStatus(`Finalizing video... ${Math.round(progress)}%`);
        }
      });
      
      setRecordingProgress(100);
      setRecordingStatus('Downloading...');

      // Download
      const url = URL.createObjectURL(videoBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'bird-song-manifold.mp4';
      a.click();
      URL.revokeObjectURL(url);

      recorderRef.current = null;
      setIsRecording(false);
      setRecordingProgress(0);
      setRecordingStatus('');
    } catch (error) {
      console.error('Error recording video:', error);
      alert('Error recording video: ' + (error instanceof Error ? error.message : 'Unknown error'));
      setIsRecording(false);
      setRecordingProgress(0);
      setRecordingStatus('');
    }
  };

  const handleDownloadSplitScreenVideo = async () => {
    if (!rendererRef.current || !originalVideoFile || points.length === 0) return;

    setIsRecording(true);
    setRecordingProgress(0);
    setRecordingStatus('Preparing recording...');
    setRecordingStartTime(performance.now());

    try {
      const recorder = new ManifoldVideoRecorder();
      recorderRef.current = recorder;

      const duration = points.length / 30;
      const options: RecordingOptions = {
        width: width * 2, // Double width for split screen
        height,
        fps: 30,
        duration: Math.min(duration, 60),
      };

      setIsPlaying(false);
      setCurrentFrame(0);
      currentFrameRef.current = 0;

      // Initialize camera to follow first point
      if (sceneRef.current) {
        const normalized = normalizePoints(points);
        if (normalized.length > 0) {
          const firstPoint = normalized[0];
          sceneRef.current.camera.position.set(
            firstPoint[0],
            firstPoint[1],
            firstPoint[2] + 2.5 // Zoomed out
          );
          sceneRef.current.camera.lookAt(firstPoint[0], firstPoint[1], firstPoint[2]);
        }
      }

      setRecordingStatus('Capturing manifold frames...');

      recorder.startRecording(rendererRef.current, options, (frame, total) => {
        setRecordingProgress((frame / total) * 30); // First 30% for recording
        setRecordingStatus(`Capturing manifold frames... ${frame}/${total}`);
        const targetFrame = Math.floor((frame / total) * points.length);
        if (targetFrame < points.length) {
          currentFrameRef.current = targetFrame;
          setCurrentFrame(targetFrame);
        }
      });

      await new Promise((resolve) => {
        const checkComplete = setInterval(() => {
          const callback = recorderRef.current?.getCaptureCallback();
          if (!recorderRef.current || !callback) {
            clearInterval(checkComplete);
            resolve(null);
          }
        }, 100);
        // Safety timeout: wait a bit longer than expected duration
        setTimeout(() => {
          clearInterval(checkComplete);
          if (recorderRef.current) {
            recorderRef.current.stopRecording();
          }
          resolve(null);
        }, (options.duration + 5) * 1000);
      });

      const frames = recorder.stopRecording();
      console.log(`Captured ${frames.length} frames for split-screen video`);
      
      if (frames.length === 0) {
        throw new Error('No frames captured');
      }

      setRecordingProgress(30);
      setRecordingStatus('Loading ffmpeg...');

      // Create split-screen video with detailed progress reporting
      const videoBlob = await recorder.createSplitScreenVideo(
        frames,
        originalVideoFile,
        options,
        (progress, status) => {
          // Progress from 30% to 100% (encoding phase)
          setRecordingProgress(30 + (progress / 100) * 70);
          setRecordingStatus(status || `Processing... ${Math.round(progress)}%`);
        }
      );
      
      setRecordingProgress(100);
      setRecordingStatus('Downloading...');

      const url = URL.createObjectURL(videoBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'bird-song-split-screen.mp4';
      a.click();
      URL.revokeObjectURL(url);

      recorderRef.current = null;
      recordingOptionsRef.current = null;
      setIsRecording(false);
      setRecordingProgress(0);
      setRecordingStatus('');
    } catch (error) {
      console.error('Error recording split-screen video:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      alert(`Error recording video: ${errorMsg}\n\nFor a 40-second clip, expect 2-4 minutes total processing time.\n\nCheck console for details.`);
      recorderRef.current = null;
      recordingOptionsRef.current = null;
      setIsRecording(false);
      setRecordingProgress(0);
      setRecordingStatus(`Error: ${errorMsg}`);
    }
  };

  return (
    <div>
      <div
        ref={containerRef}
        style={{
          width: '100%',
          maxWidth: '100%',
          border: '1px solid #ccc',
          borderRadius: '8px',
          overflow: 'hidden',
          position: 'relative',
        }}
      />
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          marginTop: '0.5rem',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <button
          onClick={handlePlayPause}
          disabled={isRecording}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: isRecording ? '#ccc' : (isPlaying ? '#dc3545' : '#28a745'),
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '0.9rem',
            cursor: isRecording ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
            opacity: isRecording ? 0.6 : 1,
          }}
        >
          {isRecording ? '⏸ Recording...' : (isPlaying ? '⏸ Pause' : '▶ Play')}
        </button>
        <button
          onClick={handleReset}
          disabled={isRecording}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: isRecording ? '#ccc' : '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '0.9rem',
            cursor: isRecording ? 'not-allowed' : 'pointer',
            opacity: isRecording ? 0.6 : 1,
          }}
        >
          ↺ Reset
        </button>
        <div style={{ fontSize: '0.85rem', color: '#666', marginLeft: '1rem' }}>
          Frame: {currentFrame} / {points.length}
        </div>
        <div style={{ fontSize: '0.85rem', color: '#666', marginLeft: '1rem' }}>
          Speed:
          <select
            value={playbackSpeed}
            onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
            disabled={isRecording}
            style={{
              marginLeft: '0.5rem',
              padding: '0.25rem',
              fontSize: '0.85rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
            }}
          >
            <option value={0.25}>0.25x</option>
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={4}>4x</option>
          </select>
        </div>
      </div>
      {isRecording && (
        <div style={{ marginTop: '0.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.9rem', color: '#007AFF', marginBottom: '0.25rem', fontWeight: 'bold' }}>
            {recordingStatus || `Processing... ${Math.round(recordingProgress)}%`}
          </div>
          <div
            style={{
              width: '100%',
              height: '4px',
              backgroundColor: '#e0e0e0',
              borderRadius: '2px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${recordingProgress}%`,
                height: '100%',
                backgroundColor: '#007AFF',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
          <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>
            {Math.round(recordingProgress)}% complete
            {recordingProgress > 5 && recordingProgress < 100 && (
              <EstimatedTime progress={recordingProgress} startTime={recordingStartTime} />
            )}
          </div>
        </div>
      )}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          marginTop: '0.5rem',
          justifyContent: 'center',
        }}
      >
        <button
          onClick={handleDownloadManifoldVideo}
          disabled={isRecording || isPlaying}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: isRecording ? '#ccc' : '#007AFF',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '0.9rem',
            cursor: isRecording ? 'not-allowed' : 'pointer',
          }}
        >
          📹 Download Manifold Video
        </button>
        {originalVideoFile && (
          <button
            onClick={handleDownloadSplitScreenVideo}
            disabled={isRecording || isPlaying}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: isRecording ? '#ccc' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.9rem',
              cursor: isRecording ? 'not-allowed' : 'pointer',
            }}
          >
          📹 Download Split-Screen Video
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * Normalize points to fit in [-1, 1] range
 */
function normalizePoints(points: number[][]): number[][] {
  if (points.length === 0) return points;

  // Find bounds
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  for (const point of points) {
    minX = Math.min(minX, point[0]);
    maxX = Math.max(maxX, point[0]);
    minY = Math.min(minY, point[1]);
    maxY = Math.max(maxY, point[1]);
    minZ = Math.min(minZ, point[2]);
    maxZ = Math.max(maxZ, point[2]);
  }

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const centerZ = (minZ + maxZ) / 2;

  const rangeX = Math.max(maxX - minX, 1e-6);
  const rangeY = Math.max(maxY - minY, 1e-6);
  const rangeZ = Math.max(maxZ - minZ, 1e-6);
  const maxRange = Math.max(rangeX, rangeY, rangeZ);
  const scale = 2.0 / maxRange;

  return points.map((point) => [
    (point[0] - centerX) * scale,
    (point[1] - centerY) * scale,
    (point[2] - centerZ) * scale,
  ]);
}

/**
 * Create trajectory line geometry
 */
function createTrajectoryGeometry(points: number[][]): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  if (points.length === 0) {
    return geometry;
  }

  const positions = new Float32Array(points.length * 3);
  for (let i = 0; i < points.length; i++) {
    positions[i * 3] = points[i][0];
    positions[i * 3 + 1] = points[i][1];
    positions[i * 3 + 2] = points[i][2];
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return geometry;
}

/**
 * Create gradient trajectory geometry with vertex colors based on time
 */
function createGradientTrajectoryGeometry(
  points: number[][],
  totalPoints: number
): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  if (points.length === 0) {
    return geometry;
  }

  const positions = new Float32Array(points.length * 3);
  const colors = new Float32Array(points.length * 3);

  for (let i = 0; i < points.length; i++) {
    // Position
    positions[i * 3] = points[i][0];
    positions[i * 3 + 1] = points[i][1];
    positions[i * 3 + 2] = points[i][2];

    // Color based on time (blue to red gradient)
    const t = i / totalPoints;
    const hue = t * 0.7; // 0 to 0.7 (blue to red)
    const color = new THREE.Color().setHSL(hue, 1.0, 0.5);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

/**
 * Create trajectory line
 */
function createTrajectory(points: number[][], color: number, opacity: number): THREE.Line {
  const geometry = createTrajectoryGeometry(points);
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    linewidth: 2,
  });
  return new THREE.Line(geometry, material);
}

/**
 * Create gradient trajectory line with vertex colors
 */
function createGradientTrajectory(points: number[][], totalPoints: number): THREE.Line {
  const geometry = createGradientTrajectoryGeometry(points, totalPoints);
  const material = new THREE.LineBasicMaterial({
    vertexColors: true, // Use vertex colors instead of uniform color
    linewidth: 3,
    transparent: false,
  });
  return new THREE.Line(geometry, material);
}

/**
 * Create frequency label sprite
 */
function createFrequencyLabel(
  magnitudeFrame: number[],
  sampleRate: number,
  frameIndex: number,
  totalFrames: number
): THREE.Sprite | null {
  if (!magnitudeFrame || magnitudeFrame.length === 0) return null;

  // Find dominant frequency (bin with max magnitude)
  let maxMagnitude = 0;
  let dominantBin = 0;
  for (let i = 0; i < magnitudeFrame.length; i++) {
    if (magnitudeFrame[i] > maxMagnitude) {
      maxMagnitude = magnitudeFrame[i];
      dominantBin = i;
    }
  }

  // Convert bin to frequency
  const fftSize = (magnitudeFrame.length - 1) * 2;
  const freqResolution = sampleRate / fftSize;
  const dominantFreq = dominantBin * freqResolution;

  // Only show label if frequency is in bird song range (500-12000 Hz)
  if (dominantFreq < 500 || dominantFreq > 12000) return null;

  // Create canvas for text
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return null;

  canvas.width = 140;
  canvas.height = 36;

  // Draw background with border
  context.fillStyle = 'rgba(0, 0, 0, 0.8)';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = '#007aff';
  context.lineWidth = 2;
  context.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);

  // Draw text
  context.fillStyle = '#ffffff';
  context.font = 'bold 13px monospace';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(`${Math.round(dominantFreq)} Hz`, canvas.width / 2, canvas.height / 2);

  // Create texture and sprite
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const spriteMaterial = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.scale.set(0.25, 0.12, 1);
  sprite.renderOrder = 999; // Render on top

  return sprite;
}

/**
 * Get color for point based on its index (time progression)
 */
function getColorForIndex(index: number, total: number): number {
  const t = index / total;
  const hue = t * 0.7; // 0 to 0.7 (blue to red)
  return new THREE.Color().setHSL(hue, 1.0, 0.5).getHex();
}

/**
 * Update camera to follow trail head during recording
 * Uses aggressive smoothing to handle tight direction changes
 */
function updateCameraForRecording(
  camera: THREE.PerspectiveCamera,
  normalized: number[][],
  currentFrame: number,
  recordingFrame: number,
  totalFrames: number,
  options: RecordingOptions,
  smoothedCameraPosRef: React.MutableRefObject<THREE.Vector3 | null>,
  smoothedDirectionRef: React.MutableRefObject<THREE.Vector3 | null>
) {
  if (normalized.length === 0) return;

  // Calculate center of all points once (this ensures we always keep it in view)
  let centerX = 0, centerY = 0, centerZ = 0;
  for (const p of normalized) {
    centerX += p[0];
    centerY += p[1];
    centerZ += p[2];
  }
  centerX /= normalized.length;
  centerY /= normalized.length;
  centerZ /= normalized.length;
  const centerPoint = new THREE.Vector3(centerX, centerY, centerZ);

  // Removed revolution - just follow the trail smoothly
  if (currentFrame < normalized.length) {
    const point = normalized[currentFrame];
    
    // Calculate direction of travel
    let direction = new THREE.Vector3(0, 0, 1); // Default forward
    if (currentFrame < normalized.length - 1) {
      const nextPoint = normalized[currentFrame + 1];
      direction = new THREE.Vector3(
        nextPoint[0] - point[0],
        nextPoint[1] - point[1],
        nextPoint[2] - point[2]
      ).normalize();
    }
    
    // Position camera behind and above the current point
    // Increased distance for smoother, less jarring following
    const followDistance = 3.0; // Even further back for smoother view
    const heightOffset = 1.2; // Higher up for better overview
    
    // Adaptive smoothing: Heavy for small movements, responsive for large direction changes
    // This eliminates buzzing while keeping the trail in view during large rotations
    let smoothedDirection = direction;
    const smoothingWindow = 40; // Average over 40 frames for smooth movement
    if (currentFrame >= smoothingWindow && currentFrame < normalized.length - smoothingWindow) {
      // Calculate average direction over a large window
      const startPoint = normalized[Math.max(0, currentFrame - smoothingWindow)];
      const endPoint = normalized[Math.min(normalized.length - 1, currentFrame + smoothingWindow)];
      const avgDirection = new THREE.Vector3(
        endPoint[0] - startPoint[0],
        endPoint[1] - startPoint[1],
        endPoint[2] - startPoint[2]
      ).normalize();
      
      // Adaptive smoothing: detect large direction changes and respond faster
      if (smoothedDirectionRef.current) {
        // Calculate angle between old and new direction
        const angle = smoothedDirectionRef.current.angleTo(avgDirection);
        // For large direction changes (>45 degrees), use faster smoothing (20%)
        // For small changes, use heavy smoothing (5%) to eliminate buzzing
        const smoothingFactor = angle > Math.PI / 4 ? 0.2 : 0.05;
        smoothedDirection = smoothedDirectionRef.current.clone().lerp(avgDirection, smoothingFactor).normalize();
      } else {
        smoothedDirection = avgDirection;
      }
      smoothedDirectionRef.current = smoothedDirection.clone();
    } else {
      // Initialize or use current direction for edges with moderate smoothing
      if (smoothedDirectionRef.current) {
        const angle = smoothedDirectionRef.current.angleTo(direction);
        const smoothingFactor = angle > Math.PI / 4 ? 0.25 : 0.1;
        smoothedDirection = smoothedDirectionRef.current.clone().lerp(direction, smoothingFactor).normalize();
      } else {
        smoothedDirection = direction;
      }
      smoothedDirectionRef.current = smoothedDirection.clone();
    }
    
    // Calculate target camera position: behind the point along the heavily smoothed direction
    const cameraOffset = smoothedDirection.clone().multiplyScalar(-followDistance);
    const idealTargetPos = new THREE.Vector3(
      point[0] + cameraOffset.x,
      point[1] + heightOffset,
      point[2] + cameraOffset.z
    );
    
    // Ensure the center point is always visible by adjusting camera position if needed
    // Calculate distance from ideal position to center
    const distanceToCenter = idealTargetPos.distanceTo(centerPoint);
    const maxDistanceFromCenter = 8.0; // Maximum distance camera can be from center
    
    let targetPos = idealTargetPos;
    if (distanceToCenter > maxDistanceFromCenter) {
      // If camera would be too far from center, pull it back towards center
      const directionToCenter = centerPoint.clone().sub(idealTargetPos).normalize();
      targetPos = centerPoint.clone().add(directionToCenter.multiplyScalar(-maxDistanceFromCenter));
      // Maintain height offset
      targetPos.y = Math.max(targetPos.y, centerPoint.y + heightOffset);
    }
    
    // Apply adaptive smoothing to camera position: faster for large movements
    if (smoothedCameraPosRef.current) {
      // Calculate distance to target position
      const distanceToTarget = smoothedCameraPosRef.current.distanceTo(targetPos);
      // For large movements (>2 units), use faster smoothing (15%)
      // For small movements, use heavy smoothing (8%) to eliminate buzzing
      const smoothingFactor = distanceToTarget > 2.0 ? 0.15 : 0.08;
      smoothedCameraPosRef.current.lerp(targetPos, smoothingFactor);
      camera.position.copy(smoothedCameraPosRef.current);
    } else {
      // Initialize
      smoothedCameraPosRef.current = targetPos.clone();
      camera.position.copy(targetPos);
    }
    
    // Look at a point ahead for smooth following, with adaptive smoothing
    // Blend between look-ahead point and center to ensure center stays visible
    const lookAheadFrames = Math.min(30, normalized.length - currentFrame - 1);
    let targetLookAt: THREE.Vector3;
    
    if (lookAheadFrames > 0) {
      const lookAheadPoint = new THREE.Vector3(
        normalized[currentFrame + lookAheadFrames][0],
        normalized[currentFrame + lookAheadFrames][1],
        normalized[currentFrame + lookAheadFrames][2]
      );
      
      // Blend between look-ahead point (70%) and center (30%) to keep center in view
      targetLookAt = lookAheadPoint.clone().lerp(centerPoint, 0.3);
    } else {
      // If no look-ahead available, blend between current point and center
      const currentPointVec = new THREE.Vector3(point[0], point[1], point[2]);
      targetLookAt = currentPointVec.clone().lerp(centerPoint, 0.3);
    }
    
    // Get current look direction
    const currentLookDir = new THREE.Vector3();
    camera.getWorldDirection(currentLookDir);
    const currentLookAt = currentLookDir.multiplyScalar(10).add(camera.position);
    
    // Calculate how far the look target has moved
    const lookTargetDistance = currentLookAt.distanceTo(targetLookAt);
    // Adaptive smoothing: faster for large movements, smooth for small
    const lookSmoothingFactor = lookTargetDistance > 3.0 ? 0.2 : 0.1;
    const smoothedLookAt = currentLookAt.clone().lerp(targetLookAt, lookSmoothingFactor);
    camera.lookAt(smoothedLookAt);
  }
}

/**
 * Component to display estimated time remaining
 */
const EstimatedTime: React.FC<{ progress: number; startTime: number }> = ({ progress, startTime }) => {
  const [estimate, setEstimate] = useState<string>('');

  useEffect(() => {
    if (progress <= 0 || progress >= 100 || startTime === 0) {
      setEstimate('');
      return;
    }

    const elapsed = (performance.now() - startTime) / 1000; // seconds
    if (elapsed < 1) {
      setEstimate('');
      return;
    }

    const rate = progress / elapsed; // % per second
    if (rate <= 0) {
      setEstimate('');
      return;
    }

    const remaining = (100 - progress) / rate; // seconds remaining

    if (remaining > 60) {
      const minutes = Math.floor(remaining / 60);
      const seconds = Math.floor(remaining % 60);
      setEstimate(` • ~${minutes}m ${seconds}s remaining`);
    } else if (remaining > 0) {
      setEstimate(` • ~${Math.ceil(remaining)}s remaining`);
    } else {
      setEstimate('');
    }
  }, [progress, startTime]);

  return <span>{estimate}</span>;
};
