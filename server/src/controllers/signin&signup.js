import user from "../models/User.js";
import OTP from "../models/Otp.js";
import crypto from "crypto";
import jwtfun, { hashingpassword, refreshjwtfun } from "../utils/jwthash.js";
import { OTPMail } from "../../config/mailtrapconfig.js";
import bcrypt from "bcryptjs";


export const createAccount = async (req, res,next) => {
  try {
    const { userName, password, email } = req.body;
    const userImage = req.file

    if (!userName || !password || !email) {
      return res
        .status(400)
        .json({ message: "please provide all the required fields" });
    }
    const cleanemail = email.toLowerCase().trim();
    const existinguser = await user.findOne({ email: cleanemail });

    if (existinguser) {
      res.status(400).json({ message: "User already exists" });
    }
    const hashedpassword = hashingpassword(password);

    if (existinguser && !existinguser.isverified) {
      ((existinguser.email = email), (existinguser.password = password));
      await existinguser.save();
    } else {
      const newuser = new user({
        name: userName,
        email: cleanemail,
        password: hashedpassword,
      });
      await newuser.save();
    }

    const generatedOTP = crypto.randomInt(100000, 999999).toString();
    await OTP.deleteMany({ email: cleanemail });
    await new OTP({ email: cleanemail, OTP: generatedOTP.trim() }).save();

    OTPMail(email, generatedOTP);
    res.status(201).json({
      message: "user saved successfully and OTP sent",
      user: userName,
    });
  } catch (error) {
    next(error);
  }
};

export const otprequest = async (
  req, res, next
) => {
  try {
    const { email, clientOTP } = req.body;

    if (!email || !clientOTP) {
      return res.status(400).json({ message: "missing required fields" });
    }

    const cleanemail = email.trim().toLowerCase();
    const activeotp = await OTP.findOne({ email: cleanemail });

    if (!activeotp) {
      return res.status(400).json({ message: "incorrect or invalid OTP" });
    }

    if (activeotp.OTP !== clientOTP) {
      return res.status(400).json({ message: "incorrect or invalid OTP" });
    }

    await activeotp.deleteOne({ _id: activeotp._id });

    const unlockuser = await user.findOneAndUpdate(
      { email: cleanemail },
      { isverified: true },
      { returnDocument: "after" },
    );

    if (!unlockuser) {
      return res.status(404).json({ message: "user was deleted or missing" });
    }

    const accesstoken = jwtfun(
      unlockuser.id,
      unlockuser.role,
      unlockuser.isBanned,
    );
    const refreshtoken = refreshjwtfun(unlockuser.id);

    res.cookie("accesstoken", accesstoken, {
      httpOnly: true,
      secure: env.Node_Env === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 60 * 1000,
    });
    res.cookie("refreshtoken", refreshtoken, {
      httpOnly: true,
      secure: env.Node_Env === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 1000 * 60 * 60 * 24 * 30,
    });

    return res.status(200).json({
      success: true,
      message: "email verified successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const loginfun = async (
  req, res, next
) => {
  try {
    const { email, password } = req.body;
    const cleanemail =
      typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!cleanemail || !password) {
      return res.status(404).json({ message: "missing required fields" });
    }
    const User = await user.findOne({ email: cleanemail });

    if (!User) {
      return res.status(400).json({ message: "incorrect email or password" });
    }
    const ismatch = await bcrypt.compare(password, User.password);

    if (!ismatch) {
      return res.status(400).json({ message: "incorrect email or password" });
    }

    const accesstoken = jwtfun(User.id, User.role, User.isBanned);
    const refreshtoken = refreshjwtfun(User.id);

    res.cookie("accesstoken", accesstoken, {
      httpOnly: true,
      secure: env.Node_Env === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 60 * 1000,
    });
    res.cookie("refreshtoken", refreshtoken, {
      httpOnly: true,
      secure: env.Node_Env === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 1000 * 60 * 60 * 24 * 30,
    });

    res.status(200).json({ message: "welcome back" });
  } catch (error) {
    next(error);
  }
};

export const logout = async (req, res) => {
  res.clearCookie("accesstoken", {
    httpOnly: true,
    secure: env.Node_Env === "production",
    sameSite: "lax",
    path: "/",
  });
  res.clearCookie("refreshtoken", {
    httpOnly: true,
    secure: env.Node_Env === "production",
    sameSite: "lax",
    path: "/",
  });
  res.status(200).json({ message: "you are logged out" });
};

export const OUTSIDEdashboardData = async (
  req, res, next
) => {
  try {
    const aggregation = await user.aggregate([
      {
        $match: {
          isactive: true,
        },
      },
      {
        $set: {
          totalvalues: { $multiply: ["$price", "$quantity"] },
        },
      },
      {
        $sort: {
          createdAt: -1,
        },
      },
      {
        $project: {
          name: 1,
          quantity: 1,
          price: 1,
          totalValue: "$totalvalues",
        },
      },
      {
        $group: {
          _id: null,
          products: {
            $push: "$$ROOT",
          },
          totalStockValue: {
            $sum: "$totalValue",
          },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      aggregation,
    });
  } catch (error) {
    next(error);
  }
};
