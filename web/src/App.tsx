import React, { useState, useCallback, useEffect, useRef } from 'react';
import { VideoImport } from './components/VideoImport';
import { ProcessingPanel } from './components/ProcessingPanel';
import { SpectrogramView } from './components/SpectrogramView';
import { ManifoldView } from './components/ManifoldView';
import { VideoMetadata, AudioExtractionResult, ProcessingProgress } from './types';
import { extractAudio } from './utils/audioExtraction';
import { AudioProcessor } from './utils/audioProcessor';

function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [processing, setProcessing] = useState<ProcessingProgress | null>(null);
  const [audioResult, setAudioResult] = useState<AudioExtractionResult | null>(null);
  const [spectrogramData, setSpectrogramData] = useState<{ data: number[][]; sampleRate: number } | null>(null);
  const [manifoldData, setManifoldData] = useState<{ points: number[][]; mfcc: number[][] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enableNoiseReduction, setEnableNoiseReduction] = useState(true);
  const [enableSourceSeparation, setEnableSourceSeparation] = useState(false);
  const processorRef = useRef<AudioProcessor | null>(null);

  // Initialize audio processor
  useEffect(() => {
    processorRef.current = new AudioProcessor();
    return () => {
      processorRef.current?.terminate();
    };
  }, []);

  const handleVideoSelected = useCallback(async (file: File, meta: VideoMetadata) => {
    setSelectedFile(file);
    setMetadata(meta);
    setError(null);
    setAudioResult(null);
    setSpectrogramData(null);
    setManifoldData(null);
    setProcessing({ stage: 'Extracting audio', progress: 0 });

    try {
      // Step 1: Extract audio
      const result = await extractAudio(file, (progress) => {
        setProcessing({ stage: 'Extracting audio', progress });
      });

      // Step 1.5: Enhance audio if requested
      let enhancedSamples = result.samples;
      if (enableNoiseReduction || enableSourceSeparation) {
        setProcessing({ stage: 'Enhancing audio', progress: 0 });
        
        if (enableNoiseReduction) {
          const { reduceNoise } = await import('./utils/audioEnhancement');
          enhancedSamples = reduceNoise(enhancedSamples, result.sampleRate);
          setProcessing({ stage: 'Enhancing audio', progress: 0.5 });
        }
        
        if (enableSourceSeparation) {
          try {
            const { isolateBirdSong, samplesToWavBlob } = await import('./utils/audioEnhancement');
            const audioBlob = samplesToWavBlob(enhancedSamples, result.sampleRate);
            enhancedSamples = await isolateBirdSong(audioBlob, (progress) => {
              setProcessing({ stage: 'Isolating bird song', progress: 0.5 + progress * 0.5 });
            });
          } catch (err) {
            console.warn('Source separation failed, using noise-reduced audio:', err);
            // Continue with noise-reduced audio
          }
        }
        
        // Update result with enhanced samples
        result.samples = enhancedSamples;
      }

      setAudioResult(result);
      setProcessing({ stage: 'Computing spectrogram', progress: 0 });

      // Step 2: Compute spectrogram
      if (processorRef.current) {
        const spectrogram = await processorRef.current.computeSpectrogram(
          result.samples,
          result.sampleRate,
          (progress) => {
            setProcessing(progress);
          }
        );

        setSpectrogramData(spectrogram);
        setProcessing({ stage: 'Computing MFCC and PCA', progress: 0 });

        // Step 3: Compute MFCC + PCA
        const mfccPca = await processorRef.current.computeMFCCPCA(
          result.samples,
          result.sampleRate,
          (progress) => {
            setProcessing(progress);
          }
        );

        setManifoldData(mfccPca);
        setProcessing(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setProcessing(null);
    }
  }, [enableNoiseReduction, enableSourceSeparation]);

  const handleCancel = useCallback(() => {
    processorRef.current?.cancel();
    setProcessing(null);
    setError('Processing cancelled');
  }, []);

  return (
    <div
      style={{
        minHeight: '100vh',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        padding: '1.5rem 1rem',
        maxWidth: '900px',
        margin: '0 auto'
      }}
    >
      <div
        style={{
          textAlign: 'center',
          marginBottom: '2rem',
          padding: '1.5rem',
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
        }}
      >
        <h1
          style={{
            fontSize: '2rem',
            fontWeight: '700',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '0.5rem'
          }}
        >
          🐦 Bird Song Visualizer
        </h1>
        <p style={{ color: '#666', fontSize: '0.95rem' }}>
          Transform bird videos into beautiful 3D acoustic manifolds
        </p>
      </div>

      <VideoImport
        onVideoSelected={handleVideoSelected}
        disabled={!!processing}
        enableNoiseReduction={enableNoiseReduction}
        enableSourceSeparation={enableSourceSeparation}
        onNoiseReductionChange={setEnableNoiseReduction}
        onSourceSeparationChange={setEnableSourceSeparation}
      />

      {processing && (
        <ProcessingPanel
          progress={processing}
          onCancel={handleCancel}
        />
      )}

      {error && (
        <div
          style={{
            padding: '1rem 1.25rem',
            backgroundColor: '#fee',
            color: '#c00',
            borderRadius: '8px',
            margin: '1rem 0',
            border: '1px solid #fcc',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
          }}
        >
          <strong>⚠️ Error:</strong> {error}
        </div>
      )}

      {audioResult && (
        <div
          style={{
            padding: '1.25rem',
            background: 'white',
            borderRadius: '12px',
            margin: '1rem 0',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.25rem', color: '#333' }}>
            ✅ Audio Extracted
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', fontSize: '0.9rem' }}>
            <div style={{ padding: '0.75rem', background: '#f8f9fa', borderRadius: '6px' }}>
              <div style={{ color: '#666', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Sample Rate</div>
              <div style={{ fontWeight: '600', color: '#333' }}>{audioResult.sampleRate.toLocaleString()} Hz</div>
            </div>
            <div style={{ padding: '0.75rem', background: '#f8f9fa', borderRadius: '6px' }}>
              <div style={{ color: '#666', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Duration</div>
              <div style={{ fontWeight: '600', color: '#333' }}>{audioResult.durationSec.toFixed(2)}s</div>
            </div>
            <div style={{ padding: '0.75rem', background: '#f8f9fa', borderRadius: '6px' }}>
              <div style={{ color: '#666', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Samples</div>
              <div style={{ fontWeight: '600', color: '#333' }}>{audioResult.samples.length.toLocaleString()}</div>
            </div>
          </div>
        </div>
      )}

      {spectrogramData && (
        <div
          style={{
            padding: '1.25rem',
            background: 'white',
            borderRadius: '12px',
            margin: '1rem 0',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: '0.75rem', fontSize: '1.25rem', color: '#333' }}>
            📊 Spectrogram
          </h2>
          <div style={{ marginBottom: '1rem', fontSize: '0.9rem', color: '#666' }}>
            {spectrogramData.data.length} frames × {spectrogramData.data[0]?.length || 0} frequency bins
          </div>
          <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid #e0e0e0' }}>
            <SpectrogramView
              data={spectrogramData.data}
              sampleRate={spectrogramData.sampleRate}
              width={800}
              height={400}
            />
          </div>
        </div>
      )}

      {manifoldData && (
        <div
          style={{
            padding: '1.25rem',
            background: 'white',
            borderRadius: '12px',
            margin: '1rem 0',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: '0.75rem', fontSize: '1.25rem', color: '#333' }}>
            🎵 3D Acoustic Manifold
          </h2>
          <div style={{ marginBottom: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
            {manifoldData.points.length} points in 3D space (PCA-reduced from {manifoldData.mfcc[0]?.length || 0} MFCC features)
          </div>
          <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '1rem', fontStyle: 'italic' }}>
            💡 Drag to rotate • Scroll to zoom • Labels show dominant frequency
          </div>
          <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid #e0e0e0' }}>
          <ManifoldView
            points={manifoldData.points}
            spectrogramData={spectrogramData?.data}
            sampleRate={spectrogramData?.sampleRate}
            originalVideoFile={selectedFile || undefined}
            audioSamples={audioResult?.samples}
            audioSampleRate={audioResult?.sampleRate}
            width={800}
            height={400}
          />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
