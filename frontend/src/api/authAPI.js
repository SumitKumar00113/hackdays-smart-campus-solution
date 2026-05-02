import axiosInstance from "./axiosInstance";

export const login = (credentials) =>
  axiosInstance.post("/auth/login", credentials);
export const register = (data) => axiosInstance.post("/auth/register", data);
export const logout = () => axiosInstance.post("/auth/logout");

export const fetchProfile = () => axiosInstance.get("/auth/profile");

export const updateProfile = (payload) =>
  axiosInstance.patch("/auth/profile", payload);
