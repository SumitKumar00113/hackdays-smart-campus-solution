const CampusMap = require("../models/CampusMap");

const getMapMarkers = async (req, res) => {
  const markers = await CampusMap.find();
  res.json(markers);
};

const addMapMarker = async (req, res) => {
  const marker = await CampusMap.create(req.body);
  res.status(201).json(marker);
};

module.exports = { getMapMarkers, addMapMarker };
