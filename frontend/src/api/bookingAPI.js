import axiosInstance from "./axiosInstance";

export const createBooking = (payload) =>
  axiosInstance.post("/bookings", payload);
export const cancelBooking = (id) => axiosInstance.delete(`/bookings/${id}`);
export const fetchBookings = () => axiosInstance.get("/bookings");
