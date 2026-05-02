const jwt = require("jsonwebtoken");
const User = require("../models/User");

/** Sets req.user when a valid Bearer token is present; otherwise continues without auth. */
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : null;

  if (!token || !process.env.JWT_SECRET) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");
    if (user) {
      req.user = user;
    }
  } catch {
    /* treat as anonymous */
  }

  next();
};

module.exports = optionalAuth;
