/**
 * FFT implementation using Cooley-Tukey radix-2 algorithm
 * Much faster than DFT (O(n log n) vs O(n²))
 */

export interface FFTResult {
  real: Float32Array;
  imag: Float32Array;
}

/**
 * Compute FFT using radix-2 Cooley-Tukey algorithm
 * Input size must be a power of 2
 */
export function computeFFT(samples: Float32Array, fftSize: number): FFTResult {
  // Ensure fftSize is a power of 2
  const actualSize = Math.pow(2, Math.ceil(Math.log2(fftSize)));
  
  // Zero-pad input to actualSize
  const input = new Float32Array(actualSize);
  for (let i = 0; i < Math.min(samples.length, actualSize); i++) {
    input[i] = samples[i];
  }
  
  return fft(input);
}

/**
 * Radix-2 Cooley-Tukey FFT
 */
function fft(x: Float32Array): FFTResult {
  const N = x.length;
  
  if (N === 1) {
    return { real: new Float32Array([x[0]]), imag: new Float32Array([0]) };
  }
  
  // Split into even and odd
  const even = new Float32Array(N / 2);
  const odd = new Float32Array(N / 2);
  for (let i = 0; i < N / 2; i++) {
    even[i] = x[2 * i];
    odd[i] = x[2 * i + 1];
  }
  
  // Recursive FFT
  const evenFFT = fft(even);
  const oddFFT = fft(odd);
  
  // Combine results
  const real = new Float32Array(N);
  const imag = new Float32Array(N);
  
  for (let k = 0; k < N / 2; k++) {
    const angle = (-2 * Math.PI * k) / N;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    
    const tReal = cos * oddFFT.real[k] - sin * oddFFT.imag[k];
    const tImag = sin * oddFFT.real[k] + cos * oddFFT.imag[k];
    
    real[k] = evenFFT.real[k] + tReal;
    imag[k] = evenFFT.imag[k] + tImag;
    real[k + N / 2] = evenFFT.real[k] - tReal;
    imag[k + N / 2] = evenFFT.imag[k] - tImag;
  }
  
  return { real, imag };
}

/**
 * Compute magnitude spectrum from FFT result
 */
export function magnitudeSpectrum(fftResult: FFTResult): Float32Array {
  const { real, imag } = fftResult;
  const magnitude = new Float32Array(fftResult.real.length);
  
  for (let i = 0; i < real.length; i++) {
    magnitude[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
  }
  
  return magnitude;
}
