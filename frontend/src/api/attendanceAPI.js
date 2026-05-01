import axiosInstance from "./axiosInstance";

export const markAttendance = (payload) =>
  axiosInstance.post("/attendance", payload);
export const fetchAttendance = () => axiosInstance.get("/attendance");
export const exportAttendance = () => axiosInstance.get("/attendance/export");
