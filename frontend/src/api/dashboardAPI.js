import axiosInstance from "./axiosInstance";

export const fetchDashboardStats = () => axiosInstance.get("/dashboard");
