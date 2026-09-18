import user from "../models/User.js";
import OTP from "../models/Otp.js";
import crypto from "crypto";
import jwtfun, { hashingpassword, refreshjwtfun } from "../utils/jwthash.js";
import { OTPMail } from "../../config/mailtrapconfig.js";
import bcrypt from "bcryptjs";
import { uploadToCloudinary } from "../middleware/upload.js";

export const createAccount = async (req, res, next) => {
  try {
    const { name, password, email } = req.body;
    const profileImage = req?.file;

    if (!name || !password || !email) {
      return res
        .status(400)
        .json({ message: "please provide all the required fields" });
    }

    const cleanemail = email.toLowerCase().trim();
    const existinguser = await user.findOne({ email: cleanemail });

    const hashedpassword = hashingpassword(password);

    if (existinguser && !existinguser.isverified) {
      existinguser.name = name;
      existinguser.email = cleanemail;
      existinguser.password = hashedpassword;

      if (profileImage) {
        const result = await uploadToCloudinary(req.file.buffer);
        existinguser.profileImage = result.secure_url;
        existinguser.Cloudinary_ID = result.public_id;
      }

      await existinguser.save();
    } else {
      if (existinguser) {
        return res.status(400).json({ message: "User already exists" });
      }

      const newUserData = {
        name: name,
        email: cleanemail,
        password: hashedpassword,
      };

      if (profileImage) {
        const result = await uploadToCloudinary(req.file.buffer);
        newUserData.profileImage = result.secure_url;
        newUserData.Cloudinary_ID = result.public_id;
      }

      const newuser = new user(newUserData);
      await newuser.save();
    }

    const generatedOTP = crypto.randomInt(100000, 999999).toString();
    const HashedOTP = hashingpassword(generatedOTP)
    await OTP.deleteMany({ email: cleanemail });
    await new OTP({ email: cleanemail, OTP: HashedOTP }).save();

    OTPMail(cleanemail, generatedOTP);
    res.status(201).json({
      message: "user saved successfully and OTP sent",
      user: name,
    });
  } catch (error) {
    next(error);
  }
};

export const otprequest = async (req, res, next) => {
  try {
    const { email, clientOTP } = req.body;

    if (!email || !clientOTP) {
      return res.status(400).json({ message: "missing required fields" });
    }

    const cleanemail = email.trim().toLowerCase();
    const activeotp = await OTP.findOne({ email: cleanemail });
    const comparignOTP = bcrypt.compare(activeotp, clientOTP)

    if (!activeotp) {
      return res.status(400).json({ message: "incorrect or invalid OTP" });
    }

    await activeotp.deleteOne({ _id: activeotp._id });

    const unlockuser = await user.findOneAndUpdate(
      { email: cleanemail },
      { isEmailVerified: true },
      { returnDocument: "after" },
    );

    if (!unlockuser) {
      return res.status(404).json({ message: "user was deleted or missing" });
    }

    const accesstoken = jwtfun(
      unlockuser.id,
      unlockuser.role,
      unlockuser.status,
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

export const loginfun = async (req, res, next) => {
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

export const OUTSIDEdashboardData = async (req, res, next) => {
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
