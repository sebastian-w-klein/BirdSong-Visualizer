/**
 * PCA (Principal Component Analysis) for dimensionality reduction
 * Reduces MFCC features to 3D for visualization
 */

/**
 * Compute PCA to 3D from MFCC features
 * Returns array of 3D points [x, y, z] for each time frame
 */
export function computePCA3D(mfcc: number[][]): number[][] {
  const frames = mfcc;
  if (frames.length === 0) {
    return [];
  }

  const featureCount = frames[0].length;
  const timeSteps = frames.length;

  // Flatten to matrix: T x F
  const matrix: number[] = [];
  for (const frame of frames) {
    matrix.push(...frame);
  }

  // Center the data (subtract mean per feature)
  const means = new Float32Array(featureCount);
  for (let t = 0; t < timeSteps; t++) {
    for (let f = 0; f < featureCount; f++) {
      means[f] += matrix[t * featureCount + f];
    }
  }
  for (let f = 0; f < featureCount; f++) {
    means[f] /= timeSteps;
  }

  for (let t = 0; t < timeSteps; t++) {
    for (let f = 0; f < featureCount; f++) {
      matrix[t * featureCount + f] -= means[f];
    }
  }

  // Compute covariance matrix: C = (1/(T-1)) * X^T * X
  const covariance = new Float32Array(featureCount * featureCount);
  const scale = 1.0 / Math.max(1, timeSteps - 1);

  for (let i = 0; i < featureCount; i++) {
    for (let j = 0; j < featureCount; j++) {
      let sum = 0;
      for (let t = 0; t < timeSteps; t++) {
        sum += matrix[t * featureCount + i] * matrix[t * featureCount + j];
      }
      covariance[i * featureCount + j] = sum * scale;
    }
  }

  // Find top 3 eigenvectors using power iteration
  const components = computeTopEigenvectors(covariance, featureCount, 3);

  // Project data: X * components^T
  const projected: number[][] = [];
  for (let t = 0; t < timeSteps; t++) {
    const point: number[] = [];
    for (let pc = 0; pc < 3; pc++) {
      let sum = 0;
      for (let f = 0; f < featureCount; f++) {
        sum += matrix[t * featureCount + f] * components[pc][f];
      }
      point.push(sum);
    }
    projected.push(point);
  }

  // Normalize each PC (z-score then scale)
  for (let pc = 0; pc < 3; pc++) {
    let mean = 0;
    for (let t = 0; t < timeSteps; t++) {
      mean += projected[t][pc];
    }
    mean /= timeSteps;

    let variance = 0;
    for (let t = 0; t < timeSteps; t++) {
      const diff = projected[t][pc] - mean;
      variance += diff * diff;
    }
    variance /= timeSteps;
    const std = Math.sqrt(variance);

    if (std > 1e-6) {
      for (let t = 0; t < timeSteps; t++) {
        projected[t][pc] = (projected[t][pc] - mean) / std;
      }
    }
  }

  return projected;
}

/**
 * Compute top k eigenvectors using power iteration
 */
function computeTopEigenvectors(
  covariance: Float32Array,
  n: number,
  k: number
): number[][] {
  const components: number[][] = [];

  for (let pcIdx = 0; pcIdx < k; pcIdx++) {
    let vec = new Float32Array(n);
    vec[pcIdx % n] = 1.0; // Initialize

    // Orthogonalize against previous components
    for (let prevIdx = 0; prevIdx < pcIdx; prevIdx++) {
      let dot = 0;
      for (let i = 0; i < n; i++) {
        dot += vec[i] * components[prevIdx][i];
      }
      for (let i = 0; i < n; i++) {
        vec[i] -= dot * components[prevIdx][i];
      }
    }

    // Power iteration (simplified - few iterations)
    for (let iter = 0; iter < 10; iter++) {
      const newVec = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          newVec[i] += covariance[i * n + j] * vec[j];
        }
      }

      // Normalize
      let norm = 0;
      for (let i = 0; i < n; i++) {
        norm += newVec[i] * newVec[i];
      }
      norm = Math.sqrt(norm);
      if (norm > 1e-6) {
        for (let i = 0; i < n; i++) {
          newVec[i] /= norm;
        }
      }

      vec = newVec;

      // Re-orthogonalize
      for (let prevIdx = 0; prevIdx < pcIdx; prevIdx++) {
        let dot = 0;
        for (let i = 0; i < n; i++) {
          dot += vec[i] * components[prevIdx][i];
        }
        for (let i = 0; i < n; i++) {
          vec[i] -= dot * components[prevIdx][i];
        }
      }
    }

    components.push(Array.from(vec));
  }

  return components;
}
