import axiosInstance from "./axiosInstance";

export const createBooking = (payload) =>
  axiosInstance.post("/bookings", payload);
export const cancelBooking = (id) => axiosInstance.delete(`/bookings/${id}`);
export const fetchBookings = () => axiosInstance.get("/bookings");
/** Authenticated POST (preferred) */
export const joinBookingSession = (bookingId) =>
  axiosInstance.post(`/bookings/join/${bookingId}`);
export const leaveBookingSession = (bookingId) =>
  axiosInstance.post(`/bookings/leave/${bookingId}`);
export const fetchBookingChat = (bookingId) =>
  axiosInstance.get(`/bookings/${bookingId}/chat`);
/** Legacy PATCH with body (demo / admin tools) */
export const joinBooking = (id, payload) =>
  axiosInstance.patch(`/bookings/${id}/join`, payload);
