import { io } from "socket.io-client";
import { getSocketBaseUrl } from "./socketUrl";

/**
 * @param {string | null | undefined} token JWT for handshake auth
 */
export function createAuthenticatedSocket(token) {
  const url = getSocketBaseUrl();
  return io(url, {
    auth: token ? { token } : {},
    transports: ["websocket", "polling"],
    autoConnect: Boolean(token),
  });
}
