import express from "express";
import User from "../models/User.js";
import vendor from "../models/vendor.js";

const router = express.Router();

router.get("/refreshShortTermToken", async (req, res, next) => {
  try {
    const longTermToken = req.cookies.refreshtoken;
    if (!longTermToken) {
      return res.status(401).json({
        success: false,
        message: "user unauthenticated or cookie expired",
      });
    }

    const user = await User.findById(longTermToken.id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "user not found" });
    }
    if (user.status === "blocked") {
      return res
        .status(403)
        .json({ success: false, message: "user is banned" });
    }

    if (user.role === "vendor") {
      const vendorID = await vendor
        .findOne({ userid: user.id })
        .select("_id")
        .lean();
      const accesstoken = jwtfun({
        id: User.id,
        role: User.role,
        vendorID: vendorID._id,
      });
    } else {
      const accesstoken = jwtfun({
        id: User.id,
        role: User.role,
      });
    }

    res.cookie("accesstoken", accesstoken, {
      httpOnly: true,
      secure: process.env.Node_Env === "production",
      sameSite: process.env.Node_Env === "production" ? "strice" : "lax",
      path: "/",
      maxAge: 20 * 60 * 1000,
    });
  } catch (error) {
    next(error);
  }
});

export default router