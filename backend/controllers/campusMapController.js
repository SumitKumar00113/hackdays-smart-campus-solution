const CampusMap = require("../models/CampusMap");
const { getCampusOrigin, getCampusLabel } = require("../utils/campusOrigin");

const NOMINATIM = "https://nominatim.openstreetmap.org";
const OSRM = "https://router.project-osrm.org";

const NOMINATIM_UA =
  "SmartCampus-Demo/1.0 (educational hackathon; campus map search)";

const getMapMarkers = async (req, res) => {
  const markers = await CampusMap.find();
  res.json(markers);
};

/** Configured campus anchor for map UI (matches seed defaults unless .env overrides). */
const getCampusMeta = async (req, res) => {
  res.json({
    origin: getCampusOrigin(),
    label: getCampusLabel(),
  });
};

/** Proxy geocoding (Nominatim) — browser-safe, proper User-Agent. Biased to Bhopal, India. */
const geocodePlaces = async (req, res) => {
  const raw = String(req.query.q || "").trim();
  if (raw.length < 2) {
    return res.status(400).json({ message: "Type at least 2 characters to search." });
  }
  const q = raw.includes("Bhopal") ? raw : `${raw}, Bhopal, India`;
  const params = new URLSearchParams({
    q,
    format: "json",
    limit: "10",
    addressdetails: "1",
    countrycodes: "in",
  });
  const url = `${NOMINATIM}/search?${params.toString()}`;
  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": NOMINATIM_UA,
        Accept: "application/json",
      },
    });
    if (!r.ok) {
      return res.status(502).json({ message: `Places search failed (${r.status})` });
    }
    const data = await r.json();
    const places = (Array.isArray(data) ? data : [])
      .map((item) => ({
        name: item.display_name,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        placeId: item.place_id,
      }))
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    res.json(places);
  } catch (err) {
    res.status(502).json({ message: err.message || "Geocoding request failed." });
  }
};

/** Driving route via OSRM (OpenStreetMap-based). Coordinates: WGS84 lat/lng. */
const getDrivingRoute = async (req, res) => {
  const fromLat = parseFloat(req.query.fromLat);
  const fromLng = parseFloat(req.query.fromLng);
  const toLat = parseFloat(req.query.toLat);
  const toLng = parseFloat(req.query.toLng);
  if (![fromLat, fromLng, toLat, toLng].every(Number.isFinite)) {
    return res.status(400).json({ message: "Invalid or missing coordinates." });
  }
  const path = `${fromLng},${fromLat};${toLng},${toLat}`;
  const url = `${OSRM}/route/v1/driving/${path}?overview=full&geometries=geojson`;
  try {
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) {
      return res.status(502).json({ message: `Routing service error (${r.status})` });
    }
    const data = await r.json();
    if (data.code !== "Ok" || !data.routes?.[0]?.geometry?.coordinates) {
      return res.status(404).json({
        message: "No driving route found between these points. Try opening Google Maps below.",
      });
    }
    const coords = data.routes[0].geometry.coordinates;
    const positions = coords.map(([lng, lat]) => [lat, lng]);
    res.json({
      positions,
      duration: data.routes[0].duration,
      distance: data.routes[0].distance,
    });
  } catch (err) {
    res.status(502).json({ message: err.message || "Routing request failed." });
  }
};

const addMapMarker = async (req, res) => {
  const marker = await CampusMap.create(req.body);
  res.status(201).json(marker);
};

module.exports = {
  getMapMarkers,
  getCampusMeta,
  geocodePlaces,
  getDrivingRoute,
  addMapMarker,
};
    