const ClassroomBooking = require("../models/ClassroomBooking");

const createBooking = async (req, res) => {
  const booking = await ClassroomBooking.create(req.body);
  res.status(201).json(booking);
};

const cancelBooking = async (req, res) => {
  const booking = await ClassroomBooking.findByIdAndUpdate(
    req.params.id,
    { status: "cancelled" },
    { new: true },
  );
  res.json(booking);
};

const getBookings = async (req, res) => {
  const bookings = await ClassroomBooking.find().populate(
    "bookedBy",
    "name email",
  );
  res.json(bookings);
};

module.exports = { createBooking, cancelBooking, getBookings };
