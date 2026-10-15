import user from "../../models/User.js";
import jwt from "jsonwebtoken";
import { forgetmail } from "../../config/mailtrapconfig.js";
import jwtfun, { hashingpassword, refreshjwtfun, resetjwtfun, } from "../../utils/jwthash.js";
import resetPasswordModel from "../../models/ResetLinkPass.js";
import env from "../../config.js";
export const forgetpassword = async (req, res, next) => {
    try {
        const { email } = req.body;
        const existinguser = await user.findOne({ email, isEmailVerified: true });
        if (!existinguser) {
            return res
                .status(200)
                .json({ message: "if email is available, the password is sent." });
        }
        const token = resetjwtfun({
            id: existinguser.id,
            type: env.JWT_RESET_TEXT,
            password: existinguser.password,
        });
        const link = `${env.Frontend_URL}/resetPassword/${token}`;
        const deleteOldLinks = await resetPasswordModel.deleteMany({
            email: email,
        });
        const TokenModel = new resetPasswordModel({
            email,
            token,
        });
        await TokenModel.save();
        await forgetmail(existinguser.email, link);
        res.status(200).json({
            success: true,
            message: "a link is sent to the email of you.",
        });
    }
    catch (error) {
        next(error);
    }
};
export const resetLink = async (req, res, next) => {
    const { password, email } = req.body;
    const token = Array.isArray(req.params.token)
        ? req.params.token[0]
        : req.params.token;
    try {
        if (!password || !token || !email) {
            return res.status(400).json({ message: "all fields are required" });
        }
        const IDuser = await user.findOne({ email }).select("password role");
        if (!IDuser) {
            return res
                .status(404)
                .json({ message: "session expired or user dont exist." });
        }
        const secret = env.JWT_temp_token + IDuser.password;
        const jwtuser = jwt.verify(token, secret);
        const hashedpassword = hashingpassword(password);
        IDuser.password = hashedpassword;
        await IDuser.save();
        const accesstoken = jwtfun({
            id: IDuser.id,
            role: IDuser.role,
        });
        const refreshtoken = refreshjwtfun({
            id: IDuser.id,
        });
        res.cookie("accesstoken", accesstoken, {
            httpOnly: true,
            secure: env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 20 * 60 * 1000,
        });
        res.cookie("refreshtoken", refreshtoken, {
            httpOnly: true,
            secure: env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 1000 * 60 * 60 * 24 * 30,
        });
        res.status(201).json({
            sucess: true,
            message: "your password reset is completed and new password is given",
        });
    }
    catch (error) {
        next(error);
    }
};
