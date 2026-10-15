import { NextFunction, Request, Response } from "express";

interface UserWithRole {
  role: string;
}

interface RequestWithUser extends Request {
  user?: UserWithRole;
}

const roleMiddleware = (...allowedroles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as RequestWithUser).user;

    if (!user) {
      return res.status(401).json({
        message: "authentication required",
      });
    }

    if (!allowedroles.includes(user.role)) {
      return res.status(403).json({
        message: "you dont have permission to access this resource",
      });
    }

    next();
  };
};

export default roleMiddleware;
