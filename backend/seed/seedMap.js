const dotenv = require("dotenv");
const connectDB = require("../config/db");
const CampusMap = require("../models/CampusMap");

dotenv.config();

const seedMap = async () => {
  await connectDB();
  await CampusMap.deleteMany({});

  const markers = [
    {
      name: "Main Library",
      description: "Central campus library",
      latitude: 40.7128,
      longitude: -74.006,
      category: "building",
    },
    {
      name: "Student Center",
      description: "Dining and student services",
      latitude: 40.7138,
      longitude: -74.007,
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
