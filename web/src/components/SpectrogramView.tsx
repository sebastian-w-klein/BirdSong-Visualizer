import React, { useEffect, useRef } from 'react';

interface SpectrogramViewProps {
  data: number[][]; // [time][frequency]
  sampleRate: number;
  width?: number;
  height?: number;
}

/**
 * Renders a spectrogram to a Canvas element
 */
export const SpectrogramView: React.FC<SpectrogramViewProps> = ({
  data,
  sampleRate,
  width = 800,
  height = 400,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data || data.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const nFrames = data.length;
    const nBins = data[0]?.length || 0;

    if (nFrames === 0 || nBins === 0) return;

    // Find min/max for normalization
    let minVal = Infinity;
    let maxVal = -Infinity;

    for (let t = 0; t < nFrames; t++) {
      for (let f = 0; f < nBins; f++) {
        const val = data[t][f];
        minVal = Math.min(minVal, val);
        maxVal = Math.max(maxVal, val);
      }
    }

    const range = maxVal - minVal || 1;

    // Clear canvas
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    // Draw spectrogram
    const frameWidth = width / nFrames;
    const binHeight = height / nBins;

    for (let t = 0; t < nFrames; t++) {
      for (let f = 0; f < nBins; f++) {
        const normalized = (data[t][f] - minVal) / range;
        const color = magnitudeToColor(normalized);

        ctx.fillStyle = color;
        ctx.fillRect(
          t * frameWidth,
          (nBins - 1 - f) * binHeight, // Flip vertically (low freq at bottom)
          frameWidth,
          binHeight
        );
      }
    }

    // Add labels
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px monospace';
    ctx.fillText('Frequency (Hz)', 10, 20);
    ctx.fillText('Time (s)', width - 100, height - 10);
  }, [data, sampleRate, width, height]);

  return (
    <div style={{ margin: '1rem 0' }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{
          width: '100%',
          maxWidth: '100%',
          height: 'auto',
          border: '1px solid #ccc',
          borderRadius: '8px',
        }}
      />
    </div>
  );
};

/**
 * Convert normalized magnitude (0-1) to color
 * Colormap: black -> blue -> cyan -> yellow -> red
 */
function magnitudeToColor(normalized: number): string {
  const clamped = Math.max(0, Math.min(1, normalized));

  if (clamped < 0.25) {
    const t = clamped / 0.25;
    return `rgb(0, 0, ${Math.floor(t * 255)})`;
  } else if (clamped < 0.5) {
    const t = (clamped - 0.25) / 0.25;
    return `rgb(0, ${Math.floor(t * 255)}, 255)`;
  } else if (clamped < 0.75) {
    const t = (clamped - 0.5) / 0.25;
    return `rgb(${Math.floor(t * 255)}, 255, ${Math.floor(255 - t * 255)})`;
  } else {
    const t = (clamped - 0.75) / 0.25;
    return `rgb(255, ${Math.floor(255 - t * 255)}, 0)`;
  }
}
