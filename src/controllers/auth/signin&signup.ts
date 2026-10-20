import user from "../../models/User.js";
import OTP from "../../models/Otp.js";
import crypto from "crypto";
import jwtfun, { hashingpassword, refreshjwtfun } from "../../utils/jwthash.js";
import bcrypt from "bcryptjs";
import vendorSchema from "../../models/vendor.js";
import { NextFunction, Request, Response } from "express";

interface newUser {
  name: any;
  email: any;
  password: string;
}

export const createAccount = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { name, password, email } = req.body;

    if (!name || !password || !email) {
      return res.status(400).json({
        success: false,
        message: "please provide all the required fields",
      });
    }

    const cleanemail = email.toLowerCase().trim();
    const hashedpassword = hashingpassword(password);
    let existinguser = await user.findOne({ email: cleanemail });

    if (existinguser && existinguser.isEmailVerified) {
      return res
        .status(400)
        .json({ success: false, message: "User already exists" });
    }

    if (existinguser && !existinguser.isEmailVerified) {
      existinguser.name = name;
      existinguser.password = hashedpassword;
      await existinguser.save();
    } else {
      const newUserData: newUser = {
        name,
        email: cleanemail,
        password: hashedpassword,
      };
      await new user(newUserData).save();
    }

    const generatedOTP = crypto.randomInt(100000, 999999).toString();
    const HashedOTP = hashingpassword(generatedOTP);
    await OTP.deleteMany({ email: cleanemail });
    await new OTP({ email: cleanemail, otp: HashedOTP }).save();

    res.status(201).json({
      success: true,
      OTP: generatedOTP,
    });
  } catch (error) {
    next(error);
  }
};

export const otprequest = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { email, clientOTP } = req.body;

    if (!email || !clientOTP) {
      return res
        .status(200)
        .json({ success: false, message: "missing required fields" });
    }

    const cleanemail = email.toLowerCase().trim();
    const activeotp = await OTP.findOne({ email: cleanemail });
    if (!activeotp) {
      return res
        .status(400)
        .json({ success: false, message: "Expired OTP provided." });
    }
    const stringOTP = clientOTP.toString();
    const comparingOTP = await bcrypt.compare(stringOTP, activeotp.otp);

    if (!comparingOTP) {
      return res
        .status(400)
        .json({ success: false, message: "incorrect OTP provided." });
    }

    await activeotp.deleteOne({ _id: activeotp._id });

    const unlockuser = await user.findOneAndUpdate(
      { email: cleanemail },
      { $set: { isEmailVerified: true, status: "active" } },
      { returnDocument: "after" },
    );

    if (!unlockuser) {
      return res
        .status(400)
        .json({ success: false, message: "user was deleted or missing" });
    }

    const accesstoken = jwtfun({
      id: unlockuser.id,
      role: unlockuser.role,
    });
    const refreshtoken = refreshjwtfun({
      id: unlockuser.id,
    });

    res.cookie("accesstoken", accesstoken, {
      httpOnly: true,
      secure: true,
      sameSite: process.env.Node_Env === "production" ? "strict" : "none",
      path: "/",
      maxAge: 20 * 60 * 1000,
    });
    res.cookie("refreshtoken", refreshtoken, {
      httpOnly: true,
      secure: true,
      sameSite: process.env.Node_Env === "production" ? "strict" : "none",
      path: "/",
      maxAge: 1000 * 60 * 60 * 24 * 30,
    });

    res.status(200).json({
      success: true,
      message: "email verified successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const loginfun = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { email, password } = req.body;
    const cleanemail =
      typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!cleanemail || !password) {
      return res
        .status(400)
        .json({ success: false, message: "missing required fields" });
    }
    const User = await user.findOne({ email: cleanemail });

    if (!User) {
      return res
        .status(400)
        .json({ success: false, message: "User does not Exist. Sign Up." });
    }
    const ismatch = await bcrypt.compare(password, User.password);

    if (!ismatch) {
      return res
        .status(400)
        .json({ success: false, message: "incorrect email or password" });
    }

    if (User.role === "vendor") {
      const vendor = await vendorSchema
        .findOne({ userid: User.id })
        .select("_id")
        .lean();
      if (!vendor) {
        return res
          .status(400)
          .json({ success: false, message: "vendor profile not found" });
      }
      const vendorID = vendor._id.toString();

      const accesstoken = jwtfun({
        id: User.id,
        role: User.role,
        vendorID: vendorID as any,
      });

      res.cookie("accesstoken", accesstoken, {
        httpOnly: true,
        secure: true,
        sameSite: process.env.Node_Env === "production" ? "strict" : "none",
        path: "/",
        maxAge: 20 * 60 * 1000,
      });
    } else {
      const accesstoken = jwtfun({
        id: User.id,
        role: User.role,
      });

      res.cookie("accesstoken", accesstoken, {
        httpOnly: true,
        secure: true,
        sameSite: process.env.Node_Env === "production" ? "strict" : "none",
        path: "/",
        maxAge: 20 * 60 * 1000,
      });
    }

    const refreshtoken = refreshjwtfun({ id: User.id });
    res.cookie("refreshtoken", refreshtoken, {
      httpOnly: true,
      secure: true,
      sameSite: process.env.Node_Env === "production" ? "strict" : "none",
      path: "/",
      maxAge: 1000 * 60 * 60 * 24 * 30,
    });

    res
      .status(200)
      .json({ success: true, message: "welcome back", Role: User.role });
  } catch (error) {
    next(error);
  }
};

export const logout = async (req: Request, res: Response) => {
  res.clearCookie("accesstoken", {
    httpOnly: true,
    secure: true,
    sameSite: process.env.Node_Env === "production" ? "strict" : "none",
    path: "/",
  });

  res.clearCookie("refreshtoken", {
    httpOnly: true,
    secure: true,
    sameSite: process.env.Node_Env === "production" ? "strict" : "none",
    path: "/",
  });

  res.status(200).json({ message: "you are logged out" });
};
