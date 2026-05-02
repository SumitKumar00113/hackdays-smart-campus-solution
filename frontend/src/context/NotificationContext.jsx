import { createContext, useCallback, useState } from "react";

export const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);

  const addNotification = useCallback((message) => {
    const text =
      typeof message === "string"
        ? message
        : message?.message || message?.notification?.message || "Notification";
    setNotifications((current) => [
      ...current,
      { id: Date.now() + Math.random(), message: text },
    ]);
  }, []);

  const clearNotifications = useCallback(() => setNotifications([]), []);

  return (
    <NotificationContext.Provider
      value={{ notifications, addNotification, clearNotifications }}
    >
      {children}
    </NotificationContext.Provider>
  );
};
