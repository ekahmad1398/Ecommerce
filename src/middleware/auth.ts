import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import env from "../config.js";


const auth = async (req:Request, res:Response, next:NextFunction) => {

  const authcookie = req.cookies.accesstoken;
  if (!authcookie) {
    return res
      .status(401)
      .json({ success: false, message: "user unauthenticated" });
  }

  try {
    const decoded = jwt.verify(authcookie, env.JWT_temp_token);

    (req as any).user = decoded

    next();
  } catch (error) {
    next(error);
  }
};

export default auth;