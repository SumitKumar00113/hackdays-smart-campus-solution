const Attendance = require("../models/Attendance");
const ClassroomBooking = require("../models/ClassroomBooking");
const Notice = require("../models/Notice");

const DEFAULT_ROOMS = [
  "Room 101",
  "Room 102",
  "Room 201",
  "Room 202",
  "Seminar Hall",
  "Computer Lab",
  "Physics Lab",
];

const pad = (value) => String(value).padStart(2, "0");

const toISODate = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const toLocalDate = (dateValue = new Date()) => {
  if (dateValue instanceof Date) return new Date(dateValue);

  if (/^\d{4}-\d{2}-\d{2}$/.test(String(dateValue))) {
    const [year, month, day] = String(dateValue).split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  return new Date(dateValue);
};

const getDateRange = (dateValue = new Date()) => {
  const start = toLocalDate(dateValue);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

const createHttpError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const timeToMinutes = (value) => {
  if (!value) return null;

  const normalized = String(value).trim().toLowerCase();
  if (normalized === "noon") return 12 * 60;
  if (normalized === "midnight") return 0;

  const twelveHour = normalized.match(
    /^(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(a\.?m\.?|p\.?m\.?)$/,
  );

  if (twelveHour) {
    let hour = Number(twelveHour[1]);
    const minute = Number(twelveHour[2] || 0);
    const suffix = twelveHour[3].replace(/\./g, "");

    if (suffix === "pm" && hour !== 12) hour += 12;
    if (suffix === "am" && hour === 12) hour = 0;

    return hour * 60 + minute;
  }

  const twentyFourHour = normalized.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (twentyFourHour) {
    return Number(twentyFourHour[1]) * 60 + Number(twentyFourHour[2]);
  }

  return null;
};

const minutesToTime = (minutes) =>
  minutes === null ? null : `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

const extractTimesFromSlot = (timeslot) => {
  const slot = String(timeslot || "").toLowerCase();
  const times = [];

  for (const match of slot.matchAll(
    /\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(a\.?m\.?|p\.?m\.?)\b/g,
  )) {
    times.push(timeToMinutes(`${match[1]}:${match[2] || "00"} ${match[3]}`));
  }

  for (const match of slot.matchAll(
    /\b([01]?\d|2[0-3]):([0-5]\d)\b(?!\s*(?:a\.?m\.?|p\.?m\.?))/g,
  )) {
    times.push(timeToMinutes(`${match[1]}:${match[2]}`));
  }

  return [...new Set(times.filter((time) => time !== null))].sort((a, b) => a - b);
};

const slotMatchesTime = (timeslot, targetTime) => {
  const targetMinutes = timeToMinutes(targetTime);
  if (targetMinutes === null) return true;

  const slotTimes = extractTimesFromSlot(timeslot);
  if (slotTimes.length === 0) {
    return String(timeslot || "").includes(minutesToTime(targetMinutes));
  }

  if (slotTimes.length === 1) {
    return slotTimes[0] === targetMinutes;
  }

  return targetMinutes >= slotTimes[0] && targetMinutes < slotTimes[slotTimes.length - 1];
};

const getConfiguredRooms = async () => {
  const configuredRooms = process.env.CAMPUS_ROOMS
    ? process.env.CAMPUS_ROOMS.split(",").map((room) => room.trim()).filter(Boolean)
    : [];
  const bookedRooms = await ClassroomBooking.distinct("room");

  return [...new Set([...configuredRooms, ...bookedRooms, ...DEFAULT_ROOMS])];
};

const getAttendance = async (userId, params = {}) => {
  if (!userId) {
    throw createHttpError("userId is required for attendance actions");
  }

  const filter = { student: userId };

  if (params.date) {
    const { start, end } = getDateRange(params.date);
    filter.date = { $gte: start, $lte: end };
  }

  const records = await Attendance.find(filter)
    .populate("student", "name email")
    .sort({ date: -1 })
    .limit(params.date ? 100 : 30);

  const summary = records.reduce(
    (totals, record) => {
      totals.total += 1;
      totals[record.status] = (totals[record.status] || 0) + 1;
      return totals;
    },
    { total: 0, present: 0, absent: 0, late: 0 },
  );

  summary.attendancePercent = summary.total
    ? Number((((summary.present + summary.late) / summary.total) * 100).toFixed(1))
    : 0;

  return {
    userId,
    date: params.date || null,
    summary,
    records,
  };
};

const getAvailableRooms = async (time, date = new Date()) => {
  const { start, end } = getDateRange(date);
  const allRooms = await getConfiguredRooms();
  const bookings = await ClassroomBooking.find({
    date: { $gte: start, $lte: end },
    status: { $ne: "cancelled" },
  }).sort({ timeslot: 1 });

  const blockingBookings = bookings.filter((booking) =>
    slotMatchesTime(booking.timeslot, time),
  );
  const bookedRooms = [...new Set(blockingBookings.map((booking) => booking.room))];

  return {
    date: toISODate(start),
    time: time || null,
    availableRooms: allRooms.filter((room) => !bookedRooms.includes(room)),
    bookedRooms,
    blockingBookings,
  };
};

const getNotices = async (params = {}) => {
  const filter = {};

  if (params.date) {
    const { start, end } = getDateRange(params.date);
    filter.publishedAt = { $gte: start, $lte: end };
  }

  const notices = await Notice.find(filter)
    .populate("author", "name")
    .sort({ publishedAt: -1 })
    .limit(params.date ? 50 : 10);

  return {
    date: params.date || null,
    count: notices.length,
    notices,
  };
};

module.exports = {
  getAttendance,
  getAvailableRooms,
  getNotices,
};
