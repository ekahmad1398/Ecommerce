import mongoose from "mongoose";
import user from "../../models/User.js";
import { hashingpassword } from "../../utils/jwthash.js";
export const changeVendorPassword = async (req, res, next) => {
    try {
        const authenticatedUser = req.user;
        const userId = authenticatedUser?.id;
        if (authenticatedUser?.role !== "vendor" ||
            !userId ||
            !mongoose.isValidObjectId(userId)) {
            return res.status(401).json({
                success: false,
                message: "A valid vendor account is required.",
            });
        }
        const email = typeof req.body.email === "string"
            ? req.body.email.trim().toLowerCase()
            : "";
        const password = typeof req.body.password === "string" ? req.body.password : "";
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and new password are required.",
            });
        }
        if (password.length < 8 || password.length > 128) {
            return res.status(400).json({
                success: false,
                message: "Password must be between 8 and 128 characters.",
            });
        }
        const account = await user.findById(userId).select("email password");
        if (!account) {
            return res.status(404).json({
                success: false,
                message: "Vendor account not found.",
            });
        }
        if (account.email !== email) {
            return res.status(400).json({
                success: false,
                message: "The email does not match your account.",
            });
        }
        account.password = hashingpassword(password);
        await account.save();
        return res.status(200).json({
            success: true,
            message: "Your password was changed successfully.",
        });
    }
    catch (error) {
        return next(error);
    }
};
