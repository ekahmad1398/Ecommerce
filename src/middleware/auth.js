import jwt from "jsonwebtoken";

const auth = async (req, res, next) => {
  const authcookie = req.cookies.accesstoken;
  if (!authcookie) {
    return res
      .status(401)
      .json({ success: false, message: "user unauthenticated" });
  }

  try {
    const decoded = jwt.verify(authcookie, process.env.JWT_SECRET);

    if (decoded.status === "blocked") {
      return res.status(403).json({
        success: false,
        message: "user is banned from performing this action",
      });
    }

    req.user = decoded

    next();
  } catch (error) {
    next(error);
  }
};

export default auth;