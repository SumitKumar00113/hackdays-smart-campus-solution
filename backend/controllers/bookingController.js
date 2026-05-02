/** @typedef {import("express").Request} Request */
/** @typedef {import("express").Response} Response */
const mongoose = require("mongoose");
const ClassroomBooking = require("../models/ClassroomBooking");
const { notifyBookingStatus } = require("../services/notificationService");

const BOOKING_NOTIFICATION_STATUSES = ["approved", "rejected", "cancelled"];

const populateBooking = async (booking) => {
  if (!booking) return null;
  await booking.populate("bookedBy", "name email");
  await booking.populate("participants", "name email");
  return booking;
};

/**
 * @param {Request} req
 * @param {Response} res
 */
const createBooking = async (req, res) => {
  const booking = await ClassroomBooking.create(req.body);
  await populateBooking(booking);
  res.status(201).json(booking);
};

/**
 * Shared join logic (PATCH legacy + POST join).
 * @param {string} bookingId
 * @param {import("mongoose").Types.ObjectId} userId
 */
const performJoin = async (bookingId, userId) => {
  const booking = await ClassroomBooking.findById(bookingId);
  if (!booking) {
    return { error: { status: 404, message: "Booking not found" } };
  }

  if (
    booking.status === "cancelled" ||
    booking.status === "rejected"
  ) {
    return {
      error: { status: 400, message: "This session is no longer available." },
    };
  }

  if (!booking.isPublic && booking.bookedBy.toString() !== userId.toString()) {
    return {
      error: {
        status: 403,
        message:
          "Private sessions are only for the host. Others cannot join from the directory.",
      },
    };
  }

  booking.participants = booking.participants || [];
  if (
    booking.participants.some(
      (participant) => participant?.toString() === userId.toString(),
    )
  ) {
    await populateBooking(booking);
    return { booking };
  }

  if (
    booking.maxParticipants &&
    booking.participants.length >= booking.maxParticipants
  ) {
    return {
      error: { status: 400, message: "The session is already full." },
    };
  }

  booking.participants.push(userId);
  await booking.save();
  await populateBooking(booking);
  return { booking };
};

/**
 * @param {Request} req
 * @param {Response} res
 */
const joinBooking = async (req, res) => {
  const userId = req.body.userId || req.user?._id;
  if (!userId) {
    return res
      .status(400)
      .json({ message: "User id is required to join a session" });
  }

  const result = await performJoin(req.params.id, userId);
  if (result.error) {
    return res.status(result.error.status).json({ message: result.error.message });
  }
  res.json(result.booking);
};

/**
 * POST /api/bookings/join/:bookingId — authenticated user only.
 */
const joinBookingPost = async (req, res) => {
  const userId = req.user?._id;
  if (!userId) {
    return res.status(401).json({ message: "Sign in to join a session." });
  }

  const bookingId = req.params.bookingId;
  if (!mongoose.Types.ObjectId.isValid(bookingId)) {
    return res.status(400).json({ message: "Invalid booking id." });
  }

  const result = await performJoin(bookingId, userId);
  if (result.error) {
    return res.status(result.error.status).json({ message: result.error.message });
  }
  res.json(result.booking);
};

/**
 * POST /api/bookings/leave/:bookingId
 */
const leaveBookingPost = async (req, res) => {
  const userId = req.user?._id;
  if (!userId) {
    return res.status(401).json({ message: "Sign in to leave a session." });
  }

  const bookingId = req.params.bookingId;
  if (!mongoose.Types.ObjectId.isValid(bookingId)) {
    return res.status(400).json({ message: "Invalid booking id." });
  }

  const booking = await ClassroomBooking.findById(bookingId);
  if (!booking) {
    return res.status(404).json({ message: "Booking not found" });
  }

  const uid = userId.toString();
  booking.participants = (booking.participants || []).filter(
    (p) => p?.toString() !== uid,
  );

  await booking.save();
  await populateBooking(booking);
  res.json(booking);
};

/**
 * GET /api/bookings/:id/chat — participants only; message history for jury / refresh.
 */
const getBookingChat = async (req, res) => {
  const userId = req.user?._id;
  if (!userId) {
    return res.status(401).json({ message: "Sign in to view chat." });
  }

  const booking = await ClassroomBooking.findById(req.params.id)
    .select("chatMessages participants bookedBy isPublic")
    .populate("chatMessages.user", "name email")
    .populate("participants", "name email")
    .populate("bookedBy", "name email");

  if (!booking) {
    return res.status(404).json({ message: "Booking not found" });
  }

  const uid = userId.toString();
  const isHost = booking.bookedBy?._id?.toString() === uid;
  const isParticipant = booking.participants?.some(
    (p) => p?._id?.toString() === uid || p?.toString() === uid,
  );

  if (!isHost && !isParticipant) {
    return res
      .status(403)
      .json({ message: "Join the session to view chat history." });
  }

  res.json({
    messages: booking.chatMessages || [],
    participants: booking.participants || [],
    bookedBy: booking.bookedBy,
  });
};

/**
 * @param {Request} req
 * @param {Response} res
 */
const cancelBooking = async (req, res) => {
  const booking = await ClassroomBooking.findByIdAndUpdate(
    req.params.id,
    { status: "cancelled" },
    { new: true },
  );

  if (!booking) {
    return res.status(404).json({ message: "Booking not found" });
  }

  await notifyBookingStatus({
    booking,
    email: req.query.email || req.body.email,
  });

  res.json(booking);
};

/**
 * @param {Request} req
 * @param {Response} res
 */
const updateBookingStatus = async (req, res) => {
  const { status } = req.body;

  if (!BOOKING_NOTIFICATION_STATUSES.includes(status)) {
    return res.status(400).json({
      message: "status must be approved, rejected, or cancelled",
    });
  }

  const booking = await ClassroomBooking.findByIdAndUpdate(
    req.params.id,
    { status },
    { new: true },
  );

  if (!booking) {
    return res.status(404).json({ message: "Booking not found" });
  }

  const notification = await notifyBookingStatus({
    booking,
    email: req.body.email || req.query.email,
  });

  res.json({ booking, notification });
};

/**
 * @param {Request} req
 * @param {Response} res
 */
const getBookings = async (req, res) => {
  const userId = req.user?._id;

  const visibility = userId
    ? {
        $or: [
          { isPublic: true },
          { bookedBy: userId },
          { participants: userId },
        ],
      }
    : { isPublic: true };

  const bookings = await ClassroomBooking.find({
    ...visibility,
    status: { $nin: ["cancelled", "rejected"] },
  })
    .populate("bookedBy", "name email")
    .populate("participants", "name email")
    .sort({ date: -1, createdAt: -1 });

  res.json(bookings);
};

module.exports = {
  createBooking,
  joinBooking,
  joinBookingPost,
  leaveBookingPost,
  getBookingChat,
  cancelBooking,
  getBookings,
  updateBookingStatus,
};
