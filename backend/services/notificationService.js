const Notification = require("../models/Notification");
const User = require("../models/User");
const { sendEmail } = require("../utils/sendEmail");

const shouldSendEmail = (email) =>
  email === true ||
  email === "true" ||
  process.env.NOTIFICATION_EMAILS === "true";

const getUserId = (user) => {
  if (!user) return null;
  if (user._id) return user._id;
  if (typeof user === "object" && typeof user.toString === "function") {
    return user.toString();
  }
  return user;
};

const sendNotificationEmail = async ({ userId, subject, message }) => {
  const user = await User.findById(userId).select("name email");

  if (!user?.email) {
    return;
  }

  await sendEmail({
    to: user.email,
    subject,
    text: message,
    html: `<p>Hi ${user.name || "Campus user"},</p><p>${message}</p>`,
  });
};

const createNotification = async ({
  userId,
  message,
  type = "general",
  metadata,
  email = false,
  subject = "Smart Campus Notification",
}) => {
  const normalizedUserId = getUserId(userId);

  if (!normalizedUserId || !message) {
    return null;
  }

  const notification = await Notification.create({
    userId: normalizedUserId,
    message,
    type,
    metadata,
  });

  if (shouldSendEmail(email)) {
    try {
      await sendNotificationEmail({
        userId: normalizedUserId,
        subject,
        message,
      });
    } catch (error) {
      console.warn("Notification email failed:", error.message);
    }
  }

  try {
    const { emitToUser } = require("../socket/socketServer");
    const plain =
      typeof notification.toObject === "function"
        ? notification.toObject()
        : notification;
    emitToUser(normalizedUserId, "notification", { notification: plain });
  } catch (err) {
    console.warn("Socket notification emit skipped:", err.message);
  }

  return notification;
};

const notifyLostFoundMatch = async ({
  item,
  candidate,
  score,
  distanceMeters,
  email = false,
}) => {
  const notifications = [];
  const messageForItemPoster = `New Lost & Found match: "${item.title}" may match "${candidate.title}" with ${score}% confidence.`;
  const messageForCandidatePoster = `New Lost & Found match: "${candidate.title}" may match "${item.title}" with ${score}% confidence.`;
  const metadata = {
    itemId: item._id,
    candidateId: candidate._id,
    score,
    distanceMeters,
  };

  const itemPosterId = getUserId(item.postedBy);
  const candidatePosterId = getUserId(candidate.postedBy);

  notifications.push(
    await createNotification({
      userId: itemPosterId,
      message: messageForItemPoster,
      type: "lost_found_match",
      metadata,
      email,
      subject: "Lost & Found match found",
    }),
  );

  if (
    candidatePosterId &&
    String(candidatePosterId) !== String(itemPosterId)
  ) {
    notifications.push(
      await createNotification({
        userId: candidatePosterId,
        message: messageForCandidatePoster,
        type: "lost_found_match",
        metadata,
        email,
        subject: "Lost & Found match found",
      }),
    );
  }

  return notifications.filter(Boolean);
};

const notifyLostFoundClaimSubmitted = async ({
  claim,
  item,
  comparison,
  email = false,
}) => {
  const admins = await User.find({ role: "admin" }).select("_id");
  const notifications = [];

  for (const admin of admins) {
    notifications.push(
      await createNotification({
        userId: admin._id,
        message: `New Lost & Found claim needs approval for "${item.title}" (${comparison.score}% match).`,
        type: "lost_found_claim_pending",
        metadata: {
          claimId: claim._id,
          itemId: item._id,
          claimantId: claim.claimant,
          score: comparison.score,
          passed: comparison.passed,
          riskFlags: comparison.riskFlags,
        },
        email,
        subject: "Lost & Found claim awaiting approval",
      }),
    );
  }

  return notifications.filter(Boolean);
};

const notifyLostFoundClaimStatus = async ({ claim, item, email = false }) => {
  const status = claim?.status;

  if (!claim?.claimant || !["approved", "rejected"].includes(status)) {
    return null;
  }

  return createNotification({
    userId: claim.claimant,
    message: `Your claim for "${item.title}" has been ${status}.`,
    type:
      status === "approved"
        ? "lost_found_claim_approved"
        : "lost_found_claim_rejected",
    metadata: {
      claimId: claim._id,
      itemId: item._id,
      status,
      adminNote: claim.adminNote,
    },
    email,
    subject: `Lost & Found claim ${status}`,
  });
};

const notifyAttendanceRisk = async ({ userId, prediction, email = false }) => {
  if (!prediction?.risk) {
    return null;
  }

  return createNotification({
    userId,
    message: prediction.message,
    type: "attendance_risk",
    metadata: prediction,
    email,
    subject: "Attendance risk alert",
  });
};

const notifyBookingStatus = async ({ booking, email = false }) => {
  const userId = getUserId(booking?.bookedBy);
  const status = booking?.status;

  if (!userId || !["approved", "rejected", "cancelled"].includes(status)) {
    return null;
  }

  const readableStatus =
    status === "cancelled" ? "cancelled" : status;
  const type =
    status === "approved"
      ? "booking_approved"
      : status === "rejected"
        ? "booking_rejected"
        : "booking_cancelled";
  const message = `Your booking for ${booking.room} on ${new Date(
    booking.date,
  ).toDateString()} at ${booking.timeslot} has been ${readableStatus}.`;

  return createNotification({
    userId,
    message,
    type,
    metadata: {
      bookingId: booking._id,
      room: booking.room,
      date: booking.date,
      timeslot: booking.timeslot,
      status,
    },
    email,
    subject: `Booking ${readableStatus}`,
  });
};

const getNotificationsForUser = async ({ userId, unreadOnly = false }) => {
  const normalizedUserId = getUserId(userId);

  if (!normalizedUserId) {
    throw new Error("userId is required");
  }

  const filter = { userId: normalizedUserId };
  if (unreadOnly) {
    filter.read = false;
  }

  return Notification.find(filter).sort({ createdAt: -1 }).limit(100);
};

module.exports = {
  createNotification,
  getNotificationsForUser,
  notifyAttendanceRisk,
  notifyBookingStatus,
  notifyLostFoundClaimStatus,
  notifyLostFoundClaimSubmitted,
  notifyLostFoundMatch,
};
