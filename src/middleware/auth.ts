import jwt from "jsonwebtoken";

const auth = async (req, res, next) => {

  const authcookie = req.cookies.accesstoken;
  if (!authcookie) {
    return res
      .status(401)
      .json({ success: false, message: "user unauthenticated" });
  }

  try {
    const decoded = jwt.verify(authcookie, process.env.JWT_temp_token);

    req.user = decoded

    next();
  } catch (error) {
    next(error);
  }
};

export default auth;