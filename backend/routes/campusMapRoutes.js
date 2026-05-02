const express = require("express");
const router = express.Router();
const {
  getMapMarkers,
  getCampusMeta,
  geocodePlaces,
  getDrivingRoute,
  addMapMarker,
} = require("../controllers/campusMapController");

router.get("/meta", getCampusMeta);
router.get("/geocode", geocodePlaces);
router.get("/route", getDrivingRoute);
router.get("/", getMapMarkers);
router.post("/", addMapMarker);

module.exports = router;
