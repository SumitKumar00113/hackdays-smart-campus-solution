import { createContext, useCallback, useMemo, useState } from "react";
import { logout as logoutRequest } from "../api/authAPI";

const readStoredUser = () => {
  try {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [token, setTokenState] = useState(() => localStorage.getItem("token"));
  const [user, setUserState] = useState(readStoredUser);

  const setToken = useCallback((value) => {
    setTokenState(value);
    if (value) localStorage.setItem("token", value);
    else localStorage.removeItem("token");
  }, []);

  const setUser = useCallback((value) => {
    setUserState(value);
    if (value) localStorage.setItem("user", JSON.stringify(value));
    else localStorage.removeItem("user");
  }, []);

  const applyAuthPayload = useCallback(
    (data) => {
      if (data?.token) setToken(data.token);
      if (data) {
        setUser({
          id: data.id,
          name: data.name,
          email: data.email,
          role: data.role,
          department: data.department,
          semester: data.semester,
          strongSubjects: data.strongSubjects,
          improvementSubjects: data.improvementSubjects,
        });
      }
    },
    [setToken, setUser],
  );

  const logout = useCallback(async () => {
    try {
      if (token) await logoutRequest();
    } catch {
      /* ignore */
    }
    setToken(null);
    setUser(null);
  }, [token, setToken, setUser]);

  const value = useMemo(
    () => ({
      user,
      setUser,
      token,
      setToken,
      applyAuthPayload,
      logout,
    }),
    [user, setUser, token, setToken, applyAuthPayload, logout],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
};
