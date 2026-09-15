import jwt from "jsonwebtoken";
import AppError from "../utils/AppError.js";

const auth = async (req, res, next) => {

  const authcookie = req.cookies.authToken;
  if (!authcookie) {
    return next(new AppError("Authentication failed. No token provided.", 401));
  }

  try {
    const decoded = jwt.verify(authcookie, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();

    }
   catch (error) {
    next(error);

  }

};

