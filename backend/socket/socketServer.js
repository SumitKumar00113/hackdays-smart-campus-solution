const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const ClassroomBooking = require("../models/ClassroomBooking");

/** @type {import("socket.io").Server | null} */
let io = null;

/** @type {Map<string, Set<string>>} */
const userIdToSocketIds = new Map();
/** @type {Map<string, string>} */
const socketIdToUserId = new Map();

/**
 * @param {string} socketId
 * @param {import("mongoose").Types.ObjectId | string} userId
 */
function registerUserSocket(socketId, userId) {
  const uid = String(userId);
  if (!userIdToSocketIds.has(uid)) {
    userIdToSocketIds.set(uid, new Set());
  }
  userIdToSocketIds.get(uid).add(socketId);
  socketIdToUserId.set(socketId, uid);
}

/** @param {string} socketId */
function unregisterSocket(socketId) {
  const uid = socketIdToUserId.get(socketId);
  if (!uid) return;
  const set = userIdToSocketIds.get(uid);
  if (set) {
    set.delete(socketId);
    if (set.size === 0) {
      userIdToSocketIds.delete(uid);
    }
  }
  socketIdToUserId.delete(socketId);
}

/**
 * Emit an event to every connected socket for a user (multiple tabs).
 * @param {import("mongoose").Types.ObjectId | string} userId
 * @param {string} event
 * @param {unknown} data
 */
function emitToUser(userId, event, data) {
  if (!io || userId == null) return;
  const set = userIdToSocketIds.get(String(userId));
  if (!set || set.size === 0) return;
  for (const sid of set) {
    io.to(sid).emit(event, data);
  }
}

/**
 * Emit to all sockets in a booking room.
 * @param {string} bookingId
 * @param {string} event
 * @param {unknown} data
 */
function emitToBookingRoom(bookingId, event, data) {
  if (!io || !bookingId) return;
  io.to(String(bookingId)).emit(event, data);
}

/**
 * @param {string | undefined} token
 * @returns {Promise<import("mongoose").Document & { name?: string; email?: string; role?: string } | null>}
 */
async function userFromSocketToken(token) {
  if (!token || !process.env.JWT_SECRET) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("name email role");
    return user;
  } catch {
    return null;
  }
}

/**
 * @param {import("http").Server} httpServer
 * @param {{ corsOrigins?: string[] | boolean }} [options]
 */
function attachSocketIO(httpServer, options = {}) {
  const { corsOrigins = true } = options;

  io = new Server(httpServer, {
    cors: {
      origin: corsOrigins,
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log(`[socket] connected: ${socket.id}`);

    const attachUserToSocket = async (token) => {
      const user = await userFromSocketToken(token);
      if (!user) return false;
      registerUserSocket(socket.id, user._id);
      socket.data.userId = String(user._id);
      socket.data.user = {
        id: String(user._id),
        name: user.name,
        email: user.email,
        role: user.role,
      };
      return true;
    };

    (async () => {
      const token = socket.handshake.auth?.token;
      if (token) {
        await attachUserToSocket(token);
      }
    })();

    socket.on("authenticate", async (payload, cb) => {
      const token = payload?.token;
      const ok = await attachUserToSocket(token);
      if (typeof cb === "function") {
        cb(
          ok
            ? { ok: true, user: socket.data.user }
            : { ok: false, message: "Invalid or missing token" },
        );
      }
    });

    socket.on("joinBookingRoom", async (payload, cb) => {
      const bookingId = payload?.bookingId;
      if (!bookingId) {
        if (typeof cb === "function") {
          cb({ ok: false, message: "bookingId is required" });
        }
        return;
      }
      if (!socket.data.userId) {
        if (typeof cb === "function") {
          cb({ ok: false, message: "Authenticate first (send JWT in handshake or authenticate event)" });
        }
        return;
      }

      const room = String(bookingId);
      await socket.join(room);

      const userData = {
        bookingId: room,
        userId: socket.data.userId,
        name: socket.data.user?.name,
        email: socket.data.user?.email,
        socketId: socket.id,
        joinedAt: new Date().toISOString(),
      };

      io.to(room).emit("userJoined", userData);

      if (typeof cb === "function") {
        cb({ ok: true });
      }
    });

    socket.on("leaveBookingRoom", async (payload, cb) => {
      const bookingId = payload?.bookingId;
      if (!bookingId) {
        if (typeof cb === "function") {
          cb({ ok: false, message: "bookingId is required" });
        }
        return;
      }

      const room = String(bookingId);
      await socket.leave(room);

      if (socket.data.userId) {
        socket.to(room).emit("userLeft", {
          bookingId: room,
          userId: socket.data.userId,
          socketId: socket.id,
        });
      }

      if (typeof cb === "function") {
        cb({ ok: true });
      }
    });

    socket.on("sendMessage", async (payload, cb) => {
      const bookingId = payload?.bookingId;
      const text = typeof payload?.text === "string" ? payload.text.trim() : "";

      if (!bookingId || !text) {
        if (typeof cb === "function") {
          cb({ ok: false, message: "bookingId and text are required" });
        }
        return;
      }

      if (!socket.data.userId) {
        if (typeof cb === "function") {
          cb({ ok: false, message: "Authenticate first" });
        }
        return;
      }

      const room = String(bookingId);
      const message = {
        id: `${socket.id}-${Date.now()}`,
        bookingId: room,
        userId: socket.data.userId,
        userName: socket.data.user?.name,
        text,
        createdAt: new Date().toISOString(),
      };

      io.to(room).emit("receiveMessage", message);

      try {
        await ClassroomBooking.findByIdAndUpdate(room, {
          $push: {
            chatMessages: {
              user: socket.data.userId,
              text,
              createdAt: new Date(),
            },
          },
        });
      } catch (err) {
        console.warn("[socket] chat persist failed:", err.message);
      }

      if (typeof cb === "function") {
        cb({ ok: true, message });
      }
    });

    socket.on("disconnect", (reason) => {
      console.log(`[socket] disconnected: ${socket.id} (${reason})`);
      unregisterSocket(socket.id);
    });
  });

  return io;
}

function getIO() {
  return io;
}

module.exports = {
  attachSocketIO,
  getIO,
  emitToUser,
  emitToBookingRoom,
};
