/** Base URL for Socket.IO (no path; client uses /socket.io). */
export function getSocketBaseUrl() {
  const env = import.meta.env.VITE_API_URL?.replace(/\/$/, "");
  if (env) {
    return env.replace(/\/api\/?$/, "") || env;
  }
  if (import.meta.env.DEV) {
    return typeof window !== "undefined" ? window.location.origin : "";
  }
  return "http://127.0.0.1:5000";
}
