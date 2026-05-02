const dotenv = require("dotenv");
const connectDB = require("../config/db");
const CampusMap = require("../models/CampusMap");
const { getCampusOrigin } = require("../utils/campusOrigin");

dotenv.config();

const seedMap = async () => {
  await connectDB();
  await CampusMap.deleteMany({});

  const { lat: O_LAT, lng: O_LNG } = getCampusOrigin();
  const markers = [
    {
      name: "TIT — Main gate",
      description: "Technocrats Institute of Technology, main entrance",
      latitude: O_LAT + 0.00035,
      longitude: O_LNG + 0.00015,
      category: "landmark",
    },
    {
      name: "Central library",
      description: "Reading hall & digital resources",
      latitude: O_LAT - 0.00025,
      longitude: O_LNG + 0.0004,
      category: "building",
    },
    {
      name: "Academic block",
      description: "Lecture halls & faculty offices",
      latitude: O_LAT + 0.0002,
      longitude: O_LNG - 0.00035,
      category: "building",
    },
    {
      name: "Workshops & labs",
      description: "Engineering labs",
      latitude: O_LAT + 0.00045,
      longitude: O_LNG + 0.0005,
      category: "building",
    },
    {
      name: "Canteen / food court",
      description: "Student dining",
      latitude: O_LAT - 0.00055,
      longitude: O_LNG - 0.0002,
      category: "service",
    },
  ];

  await CampusMap.insertMany(markers);
  console.log("Seeded campus map markers");
  process.exit();
};

seedMap().catch((err) => {
  console.error(err);
  process.exit(1);
});
