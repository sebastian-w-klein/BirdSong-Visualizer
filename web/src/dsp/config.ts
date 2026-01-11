/**
 * DSP Configuration constants
 */
export const DSP_CONFIG = {
  windowSize: 2048,
  hopSize: 512,
  melBins: 128,
  mfccCount: 40,
  fMin: 500.0,
  fMax: 12000.0,
  preEmphasisCoeff: 0.97,
  maxFrames: 2000,
} as const;
