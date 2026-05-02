import axiosInstance from "./axiosInstance";

export const fetchLostFoundItems = () => axiosInstance.get("/lostfound");

/** JSON or `FormData` (use FormData with field `image` for photo upload). */
export const postLostFoundItem = (payload) =>
  axiosInstance.post("/lostfound", payload);
export const searchLostFoundItems = (query) =>
  axiosInstance.get(`/lostfound/search?q=${encodeURIComponent(query)}`);
export const claimLostFoundItem = (itemId, claimDetails = {}, userId) => {
  const details =
    claimDetails && typeof claimDetails === "object"
      ? claimDetails
      : { userId: claimDetails };

  return axiosInstance.post("/lostfound/claim", {
    itemId,
    userId: userId || details.userId,
    answers: {
      color: details.color,
      brand: details.brand,
      uniqueIdentifier:
        details.uniqueIdentifier || details.identifier || details.serialNumber,
    },
  });
};
export const fetchLostFoundClaims = (status = "pending") =>
  axiosInstance.get(`/lostfound/claims?status=${encodeURIComponent(status)}`);
export const reviewLostFoundClaim = (claimId, status, adminNote = "") =>
  axiosInstance.patch(`/lostfound/claims/${claimId}/status`, {
    status,
    adminNote,
  });
export const fetchNearbyLostFoundItems = (params) =>
  axiosInstance.get(`/lostfound/nearby?${new URLSearchParams(params)}`);
