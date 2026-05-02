import * as faceapi from "face-api.js";

const MODEL_URL =
  "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights";

let loadPromise = null;

export async function loadFaceModels() {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
  })();
  return loadPromise;
}

/**
 * @param {HTMLVideoElement} videoEl
 * @returns {Promise<number[] | null>}
 */
export async function getFaceDescriptorFromVideo(videoEl) {
  await loadFaceModels();
  const detection = await faceapi
    .detectSingleFace(
      videoEl,
      new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }),
    )
    .withFaceLandmarks()
    .withFaceDescriptor();
  if (!detection) return null;
  return Array.from(detection.descriptor);
}

export { faceapi };
