const DESCRIPTOR_DIM = 128;
const DEFAULT_THRESHOLD = 0.55;

const l2Normalize = (vec) => {
  if (!vec?.length) return null;
  let sum = 0;
  for (let i = 0; i < vec.length; i += 1) {
    sum += vec[i] * vec[i];
  }
  const mag = Math.sqrt(sum) || 1;
  return vec.map((x) => x / mag);
};

const euclideanDistance = (a, b) => {
  if (!a?.length || !b?.length || a.length !== b.length) {
    return Number.POSITIVE_INFINITY;
  }
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
};

const isValidDescriptor = (d) =>
  Array.isArray(d) &&
  d.length === DESCRIPTOR_DIM &&
  d.every((n) => typeof n === "number" && Number.isFinite(n));

/**
 * Compare two 128-d face-api descriptors (assumed roughly L2-normalized).
 * @returns {{ distance: number, match: boolean }}
 */
const compareDescriptors = (stored, candidate, threshold = DEFAULT_THRESHOLD) => {
  const a = l2Normalize(stored);
  const b = l2Normalize(candidate);
  if (!a || !b) {
    return { distance: Number.POSITIVE_INFINITY, match: false };
  }
  const distance = euclideanDistance(a, b);
  return { distance, match: distance <= threshold };
};

module.exports = {
  DESCRIPTOR_DIM,
  DEFAULT_THRESHOLD,
  isValidDescriptor,
  compareDescriptors,
};
