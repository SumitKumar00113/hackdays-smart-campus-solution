const roleMiddleware = (allowedRoles = []) => {
  return (req, res, next) => {
    const userRole = req.user?.role;

    if (!req.user || !allowedRoles.includes(userRole)) {
      console.warn(
        `Unauthorized access attempt: user=${req.user?.email || "unknown"} role=${userRole || "none"} route=${req.originalUrl}`,
      );
      return res
        .status(403)
        .json({ message: "Forbidden: insufficient permissions" });
    }

    next();
  };
};

module.exports = roleMiddleware;
