import React, { useRef, useState } from 'react';
import { VideoMetadata } from '../types';

interface VideoImportProps {
  onVideoSelected: (file: File, metadata: VideoMetadata) => void;
  disabled?: boolean;
  enableNoiseReduction?: boolean;
  enableSourceSeparation?: boolean;
  onNoiseReductionChange?: (enabled: boolean) => void;
  onSourceSeparationChange?: (enabled: boolean) => void;
}

export const VideoImport: React.FC<VideoImportProps> = ({
  onVideoSelected,
  disabled,
  enableNoiseReduction = true,
  enableSourceSeparation = false,
  onNoiseReductionChange,
  onSourceSeparationChange,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Clean up previous video URL
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }

    const url = URL.createObjectURL(file);
    setVideoUrl(url);

    // Load video metadata
    const video = document.createElement('video');
    video.src = url;
    video.preload = 'metadata';

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => {
        const meta: VideoMetadata = {
          filename: file.name,
          duration: video.duration,
          size: file.size,
          type: file.type || 'video/*'
        };
        setMetadata(meta);
        resolve();
      };
      video.onerror = () => {
        reject(new Error('Failed to load video metadata'));
      };
      video.load();
    });
  };

  const handleProcess = () => {
    const file = fileInputRef.current?.files?.[0];
    if (file && metadata) {
      onVideoSelected(file, metadata);
    }
  };

  const handleReset = () => {
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
      setVideoUrl(null);
    }
    setMetadata(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div style={{ padding: '0', maxWidth: '100%' }}>
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        onChange={handleFileChange}
        disabled={disabled}
        style={{ display: 'none' }}
        id="video-input"
      />
      <label
        htmlFor="video-input"
        style={{
          display: 'block',
          padding: '1rem 1.5rem',
          background: disabled ? '#ccc' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          borderRadius: '10px',
          textAlign: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontSize: '1rem',
          fontWeight: '600',
          marginBottom: '1rem',
          boxShadow: disabled ? 'none' : '0 4px 12px rgba(102, 126, 234, 0.4)',
          transition: 'all 0.2s ease'
        }}
      >
        {metadata ? '📁 Change Video' : '📁 Import Bird Video'}
      </label>

      {metadata && (
        <div
          style={{
            padding: '1.25rem',
            background: 'white',
            borderRadius: '12px',
            marginBottom: '1rem',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
          }}
        >
          <div style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #e0e0e0' }}>
            <div style={{ marginBottom: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
              <strong style={{ color: '#333' }}>File:</strong> {metadata.filename}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', fontSize: '0.9rem' }}>
              <div>
                <span style={{ color: '#666' }}>Duration:</span>{' '}
                <strong style={{ color: '#333' }}>{metadata.duration.toFixed(2)}s</strong>
              </div>
              <div>
                <span style={{ color: '#666' }}>Size:</span>{' '}
                <strong style={{ color: '#333' }}>{(metadata.size / 1024 / 1024).toFixed(2)} MB</strong>
              </div>
            </div>
          </div>
          
          {/* Audio Enhancement Options */}
          <div
            style={{
              padding: '1rem',
              background: '#f8f9fa',
              borderRadius: '8px',
              border: '1px solid #e0e0e0'
            }}
          >
            <div style={{ marginBottom: '0.75rem', fontWeight: '600', fontSize: '0.95rem', color: '#333' }}>
              🎛️ Audio Enhancement:
            </div>
            
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: '0.5rem',
                cursor: disabled ? 'not-allowed' : 'pointer'
              }}
            >
              <input
                type="checkbox"
                checked={enableNoiseReduction}
                onChange={(e) => onNoiseReductionChange?.(e.target.checked)}
                disabled={disabled}
                style={{ marginRight: '0.5rem', cursor: disabled ? 'not-allowed' : 'pointer' }}
              />
              <span style={{ fontSize: '0.9rem' }}>
                Reduce noise (wind, background) - Fast, always available
              </span>
            </label>
            
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                cursor: disabled ? 'not-allowed' : 'pointer'
              }}
            >
              <input
                type="checkbox"
                checked={enableSourceSeparation}
                onChange={(e) => onSourceSeparationChange?.(e.target.checked)}
                disabled={disabled}
                style={{ marginRight: '0.5rem', cursor: disabled ? 'not-allowed' : 'pointer' }}
              />
              <span style={{ fontSize: '0.9rem' }}>
                Isolate bird song (removes speech, other sounds) - Requires internet, ~30-60s
              </span>
            </label>
          </div>
          
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
            <button
              onClick={handleProcess}
              disabled={disabled}
              style={{
                flex: 1,
                padding: '0.875rem 1.5rem',
                background: disabled ? '#ccc' : 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: disabled ? 'not-allowed' : 'pointer',
                boxShadow: disabled ? 'none' : '0 4px 12px rgba(40, 167, 69, 0.3)'
              }}
            >
              ▶️ Process
            </button>
            <button
              onClick={handleReset}
              disabled={disabled}
              style={{
                padding: '0.875rem 1.5rem',
                background: disabled ? '#ccc' : '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: '500',
                cursor: disabled ? 'not-allowed' : 'pointer',
                boxShadow: disabled ? 'none' : '0 2px 6px rgba(0, 0, 0, 0.15)'
              }}
            >
              Reset
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
