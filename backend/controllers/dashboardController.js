const jwt = require("jsonwebtoken");
const User = require("../models/User");
const ClassroomBooking = require("../models/ClassroomBooking");
const Notice = require("../models/Notice");
const LostFound = require("../models/LostFound");
const Attendance = require("../models/Attendance");

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const getDashboard = async (req, res) => {
  let userId = null;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const decoded = jwt.verify(
        authHeader.slice(7),
        process.env.JWT_SECRET,
      );
      userId = decoded.id;
    } catch {
      userId = null;
    }
  }

  const today = startOfToday();

  const [
    totalStudents,
    totalTeachers,
    activeBookings,
    openLostFound,
    noticeCount,
    recentNotices,
    upcomingBookings,
    myAttendanceRecords,
  ] = await Promise.all([
    User.countDocuments({ role: "student" }),
    User.countDocuments({ role: "teacher" }),
    ClassroomBooking.countDocuments({
      status: { $nin: ["cancelled", "rejected"] },
      date: { $gte: today },
    }),
    LostFound.countDocuments({ status: { $ne: "claimed" } }),
    Notice.countDocuments(),
    Notice.find()
      .sort({ publishedAt: -1 })
      .limit(5)
      .populate("author", "name")
      .lean(),
    ClassroomBooking.find({
      status: { $nin: ["cancelled", "rejected"] },
      date: { $gte: today },
    })
      .sort({ date: 1, timeslot: 1 })
      .limit(12)
      .populate("bookedBy", "name email")
      .lean(),
    userId
      ? Attendance.find({ student: userId })
          .sort({ date: -1 })
          .limit(200)
          .lean()
      : Promise.resolve([]),
  ]);

  let myAttendancePercent = null;
  if (userId && myAttendanceRecords.length) {
    const present = myAttendanceRecords.filter(
      (r) => r.status === "present" || r.status === "late",
    ).length;
    myAttendancePercent = Math.round((present / myAttendanceRecords.length) * 100);
  }

  res.json({
    stats: {
      totalStudents,
      totalTeachers,
      activeBookings,
      openLostFound,
      noticeCount,
      myAttendancePercent,
      myBookingsJoined: userId
        ? await ClassroomBooking.countDocuments({
            participants: userId,
            date: { $gte: today },
          })
        : 0,
    },
    recentNotices,
    upcomingBookings,
  });
};

module.exports = { getDashboard };
