import { Request, Response, NextFunction } from "express";

const errorhandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  console.log(err);
  res.status(500);
  res.json({
    message: err.message || "internal server error",
  });
};
