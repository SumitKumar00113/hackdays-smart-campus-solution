const express = require("express");
const router = express.Router();
const {
  getMapMarkers,
  addMapMarker,
} = require("../controllers/campusMapController");

router.get("/", getMapMarkers);
router.post("/", addMapMarker);

module.exports = router;
