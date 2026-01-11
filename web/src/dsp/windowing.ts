/**
 * Window functions for signal processing
 */

export function hannWindow(size: number): Float32Array {
  const window = new Float32Array(size);
  const n = size - 1;
  for (let i = 0; i < size; i++) {
    const x = i / n;
    window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * x));
  }
  return window;
}

export function applyWindow(samples: Float32Array, window: Float32Array): Float32Array {
  if (samples.length !== window.length) {
    throw new Error('Samples and window must have the same length');
  }
  const result = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    result[i] = samples[i] * window[i];
  }
  return result;
}
