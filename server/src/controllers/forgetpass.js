import bcrypt from "bcryptjs";
import user from "../models/User.js";
import jwt from "jsonwebtoken";
import env from "../config.js";
import { forgetmail } from "../../config/mailtrapconfig.js";
import resetPasswordModel from "../utils/jwthash.js";


export const forgetpassword = async (
  req, res, next
) => {
  try {
    const { email } = req.body;
    const existinguser = await user.findOne({ email });

    if (!existinguser) {
      return res
        .status(200)
        .json({ message: "if email is available, the password is sent." });
    }

    const token = resetjwtfun(
      existinguser.id,
      env.JWT_RESET_TEXT,
      existinguser.password,
    );
    const link = `${env.Frontend_URL}/resetPassword/${token}`;

    const TokenModel = new resetPasswordModel({
      email,
      token
    });
    await TokenModel.save();
    await forgetmail(existinguser.email, link);
  } catch (error) {
    next(error);
  }
};

export const resetLink = async (
  req,
  res,
  next,
) => {
  const { password, id } = req.body;
  const token = req.params.token;
  try {
    if (!password || !token || !id) {
      return res.status(400).json({ message: "all fields are required" });
    }
    const IDuser = await user
      .findById(id)
      .select("password rules ");

    if (!IDuser) {
      return res.status(404).json({ message: "session expired" });
    }

    const secret = env.JWT_temp_token + IDuser.password;

    const jwtuser = jwt.verify(token, secret)

    const hashedpassword = hashingpassword(password);

    IDuser.password = hashedpassword;
    await IDuser.save();

    res.status(201).json({
      message: "your password reset is completed and new password is given",
    });
  } catch (error) {
    next(error);
  }
};

