export const roleMiddleware = (...allowedroles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: "authentication required",
      });
    }

    if (!allowedroles.includes(req.user.role)) {
      return res.status(403).json({
        message: "you dont have permission to access this resource",
      });
    }

    next();
  };
};