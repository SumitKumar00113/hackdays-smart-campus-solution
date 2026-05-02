/** Map axios errors to a short user-visible message. */
export function getApiErrorMessage(err, fallback) {
  const serverMsg = err.response?.data?.message;
  if (serverMsg) return serverMsg;

  const hasRequest = Boolean(err.request);
  const noResponse = !err.response;
  if (noResponse && hasRequest) {
    return "Cannot reach the server. Open a second terminal, go to the backend folder, and run npm run dev (default port 5000). MongoDB must be running with MONGODB_URI and JWT_SECRET set in backend/.env.";
  }

  return fallback;
}
