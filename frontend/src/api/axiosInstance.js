import axios from "axios";

const envBase = import.meta.env.VITE_API_URL?.replace(/\/$/, "");
const baseURL =
  envBase || (import.meta.env.DEV ? "/api" : "http://localhost:5000/api");

const axiosInstance = axios.create({
  baseURL,
  withCredentials: true,
});

axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default axiosInstance;
