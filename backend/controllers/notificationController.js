const { getNotificationsForUser } = require("../services/notificationService");

const getNotifications = async (req, res) => {
  const userId = req.user?._id || req.query.userId;
  const unreadOnly = req.query.unreadOnly === "true";

  try {
    const notifications = await getNotificationsForUser({
      userId,
      unreadOnly,
    });

    res.json({
      count: notifications.length,
      notifications,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

module.exports = {
  getNotifications,
};
