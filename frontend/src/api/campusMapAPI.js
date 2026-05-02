import axiosInstance from "./axiosInstance";

export const fetchMapMarkers = () => axiosInstance.get("/campus-map");

/** Campus anchor from server env (matches seeded marker region). */
export const fetchMapMeta = () => axiosInstance.get("/campus-map/meta");

/** Search places (Nominatim via backend). */
export const fetchGeocode = (q) =>
  axiosInstance.get("/campus-map/geocode", { params: { q } });

/** Driving route from campus to destination (OSRM via backend). */
export const fetchDrivingRoute = ({ fromLat, fromLng, toLat, toLng }) =>
  axiosInstance.get("/campus-map/route", {
    params: { fromLat, fromLng, toLat, toLng },
  });
