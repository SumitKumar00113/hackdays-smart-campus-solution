import axiosInstance from "./axiosInstance";

export const markAttendance = (payload) =>
  axiosInstance.post("/attendance", payload);
export const fetchAttendance = () => axiosInstance.get("/attendance");
export const exportAttendance = () => axiosInstance.get("/attendance/export");
export const fetchAttendanceAIInsights = () =>
  axiosInstance.get("/attendance/ai-insights");

export const generateAttendanceQR = (payload) =>
  axiosInstance.post("/attendance/generate-qr", payload);
export const verifyAttendanceScan = (payload) =>
  axiosInstance.post("/attendance/verify-scan", payload);
export const enrollFace = (payload) =>
  axiosInstance.post("/attendance/face/enroll", payload);
export const getFaceEnrollment = () =>
  axiosInstance.get("/attendance/face/enrollment");

/** Instructor: issue a time-limited 6-digit code for a selected room (show in class only). */
export const issueAttendanceRoomCode = (payload) =>
  axiosInstance.post("/attendance/room-code/issue", payload);

/** Student: redeem code to mark present for that room (one use per code per student per day). */
export const redeemAttendanceRoomCode = (payload) =>
  axiosInstance.post("/attendance/room-code/redeem", payload);
