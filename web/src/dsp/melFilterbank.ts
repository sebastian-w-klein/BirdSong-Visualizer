import { DSP_CONFIG } from './config';

/**
 * Mel filterbank for converting linear frequency to mel scale
 */
export class MelFilterbank {
  private filters: Float32Array[];
  private sampleRate: number;
  private fftSize: number;
  private melBins: number;
  private fMin: number;
  private fMax: number;

  constructor(
    sampleRate: number,
    fftSize: number,
    melBins: number = DSP_CONFIG.melBins,
    fMin: number = DSP_CONFIG.fMin,
    fMax: number = DSP_CONFIG.fMax
  ) {
    this.sampleRate = sampleRate;
    this.fftSize = fftSize;
    this.melBins = melBins;
    this.fMin = fMin;
    this.fMax = Math.min(fMax, sampleRate / 2.0);

    this.filters = this.createFilters();
  }

  /**
   * Apply mel filterbank to magnitude spectrum
   */
  apply(magnitudeSpectrum: Float32Array): Float32Array {
    const expectedBins = Math.floor(this.fftSize / 2) + 1;
    if (magnitudeSpectrum.length !== expectedBins) {
      throw new Error(`Magnitude spectrum size mismatch: expected ${expectedBins}, got ${magnitudeSpectrum.length}`);
    }

    const melSpectrum = new Float32Array(this.melBins);

    for (let melIdx = 0; melIdx < this.melBins; melIdx++) {
      let sum = 0;
      const filterSize = Math.min(this.filters[melIdx].length, magnitudeSpectrum.length);
      for (let freqIdx = 0; freqIdx < filterSize; freqIdx++) {
        sum += this.filters[melIdx][freqIdx] * magnitudeSpectrum[freqIdx];
      }
      melSpectrum[melIdx] = sum;
    }

    return melSpectrum;
  }

  private createFilters(): Float32Array[] {
    const nyquist = this.sampleRate / 2.0;
    const freqResolution = this.sampleRate / this.fftSize;
    const nFreqBins = Math.floor(this.fftSize / 2) + 1;

    // Convert Hz to Mel
    const hzToMel = (hz: number): number => {
      return 2595 * Math.log10(1 + hz / 700);
    };

    // Convert Mel to Hz
    const melToHz = (mel: number): number => {
      return 700 * (Math.pow(10, mel / 2595) - 1);
    };

    const melMin = hzToMel(this.fMin);
    const melMax = hzToMel(this.fMax);
    const melSpacing = (melMax - melMin) / (this.melBins + 1);

    const centerFreqs: number[] = [];
    for (let i = 0; i < this.melBins + 2; i++) {
      const mel = melMin + melSpacing * i;
      centerFreqs.push(melToHz(mel));
    }

    const filters: Float32Array[] = [];

    for (let melIdx = 0; melIdx < this.melBins; melIdx++) {
      const filter = new Float32Array(nFreqBins);
      const leftFreq = centerFreqs[melIdx];
      const centerFreq = centerFreqs[melIdx + 1];
      const rightFreq = centerFreqs[melIdx + 2];

      for (let freqIdx = 0; freqIdx < nFreqBins; freqIdx++) {
        const freq = freqIdx * freqResolution;

        if (freq >= leftFreq && freq <= centerFreq) {
          const slope = (freq - leftFreq) / (centerFreq - leftFreq);
          filter[freqIdx] = slope;
        } else if (freq > centerFreq && freq <= rightFreq) {
          const slope = (rightFreq - freq) / (rightFreq - centerFreq);
          filter[freqIdx] = slope;
        }
      }

      filters.push(filter);
    }

    return filters;
  }
}
