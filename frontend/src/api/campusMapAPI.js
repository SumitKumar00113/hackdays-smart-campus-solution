import axiosInstance from "./axiosInstance";

export const fetchMapMarkers = () => axiosInstance.get("/campus-map");
