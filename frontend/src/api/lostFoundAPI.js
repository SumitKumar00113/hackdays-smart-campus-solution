import axiosInstance from "./axiosInstance";

export const postLostFoundItem = (payload) =>
  axiosInstance.post("/lostfound", payload);
export const searchLostFoundItems = (query) =>
  axiosInstance.get(`/lostfound/search?q=${encodeURIComponent(query)}`);
export const claimLostFoundItem = (id, userId) =>
  axiosInstance.post(`/lostfound/${id}/claim`, { userId });
