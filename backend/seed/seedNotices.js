const dotenv = require("dotenv");
const connectDB = require("../config/db");
const Notice = require("../models/Notice");

dotenv.config();

const seedNotices = async () => {
  await connectDB();
  await Notice.deleteMany({});

  const notices = [
    {
      title: "Campus Clean-Up",
      body: "Join the campus clean-up event on Saturday.",
      author: null,
      audience: "all",
    },
    {
      title: "New Lab Timings",
      body: "Science lab hours have changed from 8 AM to 6 PM.",
      author: null,
      audience: "students",
    },
  ];

  await Notice.insertMany(notices);
  console.log("Seeded notices");
  process.exit();
};

seedNotices().catch((err) => {
  console.error(err);
  process.exit(1);
});
