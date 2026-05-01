import axiosInstance from "./axiosInstance";

export const fetchNotices = () => axiosInstance.get("/notices");
export const postNotice = (payload) => axiosInstance.post("/notices", payload);
