/**
 * Default: Technocrats Institute of Technology (TIT), Anand Nagar / Hataikheda, Bhopal.
 * Override in backend/.env: CAMPUS_ORIGIN_LAT, CAMPUS_ORIGIN_LNG, CAMPUS_LABEL
 */
const getCampusOrigin = () => ({
  lat: parseFloat(process.env.CAMPUS_ORIGIN_LAT || "23.2612"),
  lng: parseFloat(process.env.CAMPUS_ORIGIN_LNG || "77.4985"),
});

const getCampusLabel = () =>
  process.env.CAMPUS_LABEL ||
  "Technocrats Institute of Technology (TIT), Bhopal";

module.exports = { getCampusOrigin, getCampusLabel };
