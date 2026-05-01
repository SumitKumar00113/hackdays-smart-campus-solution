const getDashboard = async (req, res) => {
  res.json({
    message: "Dashboard data placeholder",
    stats: {
      totalStudents: 0,
      totalTeachers: 0,
      activeBookings: 0,
      recentNotices: [],
    },
  });
};

module.exports = { getDashboard };
