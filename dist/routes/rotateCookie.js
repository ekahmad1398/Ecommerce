import express from "express";
import User from "../models/User.js";
import vendor from "../models/vendor.js";
import jwtfun from "../utils/jwthash.js";
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
        let accesstoken;
        if (user.role === "vendor") {
            const vendorID = await vendor
                .findOne({ userid: user.id })
                .select("_id")
                .lean();
            if (!vendorID) {
                return res
                    .status(404)
                    .json({ success: false, message: "vendor not found" });
            }
            accesstoken = jwtfun({
                id: user.id,
                role: user.role,
                vendorID: vendorID._id.toString(),
            });
        }
        else {
            accesstoken = jwtfun({
                id: user.id,
                role: user.role,
            });
        }
        res.cookie("accesstoken", accesstoken, {
            httpOnly: true,
            secure: process.env.Node_Env === "production",
            sameSite: process.env.Node_Env === "production" ? "strict" : "lax",
            path: "/",
            maxAge: 20 * 60 * 1000,
        });
    }
    catch (error) {
        next(error);
    }
});
export default router;
