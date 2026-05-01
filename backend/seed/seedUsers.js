const mongoose = require("mongoose");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const connectDB = require("../config/db");

dotenv.config();

const seedUsers = async () => {
  await connectDB();
  await User.deleteMany({});

  const users = [
    {
      name: "Alice Student",
      email: "alice@student.edu",
      password: await bcrypt.hash("password", 10),
      role: "student",
    },
    {
      name: "Bob Teacher",
      email: "bob@teacher.edu",
      password: await bcrypt.hash("password", 10),
      role: "teacher",
    },
    {
      name: "Carol Admin",
      email: "carol@admin.edu",
      password: await bcrypt.hash("password", 10),
      role: "admin",
    },
  ];

  await User.insertMany(users);
  console.log("Seeded users");
  process.exit();
};

seedUsers().catch((err) => {
  console.error(err);
  process.exit(1);
});
