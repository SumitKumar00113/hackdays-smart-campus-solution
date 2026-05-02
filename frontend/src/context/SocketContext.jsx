import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createAuthenticatedSocket } from "../lib/socketClient";
import useAuth from "../hooks/useAuth";
import { NotificationContext } from "./NotificationContext";

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { token } = useAuth();
  const { addNotification } = useContext(NotificationContext);
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!token) {
      setSocket((prev) => {
        prev?.disconnect();
        return null;
      });
      setConnected(false);
      return undefined;
    }

    const s = createAuthenticatedSocket(token);

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    const onNotification = (payload) => {
      addNotification(payload);
    };

    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);
    s.on("notification", onNotification);

    setSocket(s);

    return () => {
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
      s.off("notification", onNotification);
      s.disconnect();
      setConnected(false);
    };
  }, [token, addNotification]);

  const value = useMemo(
    () => ({ socket, connected }),
    [socket, connected],
  );

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
