/**
 * Populates demo data for showcases. Safe to run multiple times (skips if data exists).
 * Usage: from backend folder, `node scripts/seedDemo.js`
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Notice = require("../models/Notice");
const CampusMap = require("../models/CampusMap");
const ClassroomBooking = require("../models/ClassroomBooking");
const LostFound = require("../models/LostFound");
const { getCampusOrigin } = require("../utils/campusOrigin");

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!uri) {
  console.error("Set MONGODB_URI in .env");
  process.exit(1);
}

const ensureUser = async ({ name, email, password, role, department }) => {
  let user = await User.findOne({ email });
  if (!user) {
    const hashed = await bcrypt.hash(password, 10);
    user = await User.create({
      name,
      email,
      password: hashed,
      role,
      department,
    });
    console.log("Created user:", email);
  }
  return user;
};

const run = async () => {
  await mongoose.connect(uri);
  console.log("Connected to MongoDB");

  const student = await ensureUser({
    name: "Demo Student",
    email: "student@campus.demo",
    password: "demo1234",
    role: "student",
    department: "Computer Science",
  });

  const teacher = await ensureUser({
    name: "Demo Teacher",
    email: "teacher@campus.demo",
    password: "demo1234",
    role: "teacher",
    department: "Computer Science",
  });

  if ((await Notice.countDocuments()) === 0) {
    await Notice.insertMany([
      {
        title: "Library hours extended during finals",
        body: "Main library now open until midnight through May 15. Group study rooms can be booked via CampusConnect.",
        author: teacher._id,
        audience: "students",
      },
      {
        title: "Career fair — Engineering quad",
        body: "Meet 40+ employers this Thursday 10am–3pm. Bring your student ID and updated resumes.",
        author: teacher._id,
        audience: "all",
      },
      {
        title: "Shuttle route B detour",
        body: "North gate construction: shuttle B stops at the temporary stand by the sports center until further notice.",
        author: teacher._id,
        audience: "all",
      },
    ]);
    console.log("Seeded notices");
  }

  if ((await CampusMap.countDocuments()) === 0) {
    const { lat: O_LAT, lng: O_LNG } = getCampusOrigin();
    await CampusMap.insertMany([
      {
        name: "TIT — Main gate",
        description: "Technocrats Institute of Technology, Bhopal",
        latitude: O_LAT + 0.00035,
        longitude: O_LNG + 0.00015,
        category: "landmark",
      },
      {
        name: "Central library",
        description: "Reading & study spaces",
        latitude: O_LAT - 0.00025,
        longitude: O_LNG + 0.0004,
        category: "building",
      },
      {
        name: "Academic block",
        description: "Lecture halls",
        latitude: O_LAT + 0.0002,
        longitude: O_LNG - 0.00035,
        category: "building",
      },
      {
        name: "Visitor parking",
        description: "Near main approach",
        latitude: O_LAT + 0.00055,
        longitude: O_LNG + 0.00035,
        category: "parking",
      },
      {
        name: "Canteen",
        description: "Food court",
        latitude: O_LAT - 0.00055,
        longitude: O_LNG - 0.0002,
        category: "service",
      },
    ]);
    console.log(
      "Seeded campus map markers near",
      O_LAT.toFixed(4),
      O_LNG.toFixed(4),
      "(set CAMPUS_ORIGIN_LAT / CAMPUS_ORIGIN_LNG to change)",
    );
  }

  if ((await ClassroomBooking.countDocuments()) === 0) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);

    await ClassroomBooking.insertMany([
      {
        room: "Science Hall 402",
        bookedBy: student._id,
        subject: "Advanced Algorithms",
        description: "Lecture + review session",
        date: tomorrow,
        timeslot: "10:00 AM – 11:30 AM",
        purpose: "Teaching",
        status: "approved",
        isPublic: true,
        maxParticipants: 30,
      },
      {
        room: "Engineering Lab 1",
        bookedBy: teacher._id,
        subject: "Database Systems Lab",
        date: tomorrow,
        timeslot: "1:30 PM – 3:00 PM",
        purpose: "Lab",
        status: "approved",
        isPublic: true,
        maxParticipants: 24,
      },
      {
        room: "Campus Commons",
        bookedBy: student._id,
        subject: "Study group — OS midterm",
        description: "Open study; bring past papers",
        date: dayAfter,
        timeslot: "4:00 PM – 6:00 PM",
        purpose: "Study",
        status: "approved",
        isPublic: true,
        maxParticipants: 12,
      },
    ]);
    console.log("Seeded room bookings");
  }

  if ((await LostFound.countDocuments()) === 0) {
    await LostFound.insertMany([
      {
        title: "Black water bottle",
        description: "Insulated metal bottle with CS dept sticker",
        status: "lost",
        locationName: "Near library café",
        postedBy: student._id,
      },
      {
        title: "Graphing calculator",
        description: "TI-84 in gray case, name faded on back",
        status: "found",
        locationName: "Science Hall lost & found desk",
        postedBy: teacher._id,
      },
    ]);
    console.log("Seeded lost & found items");
  }

  console.log("\nDemo logins:");
  console.log("  student@campus.demo / demo1234");
  console.log("  teacher@campus.demo / demo1234");
  await mongoose.disconnect();
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
