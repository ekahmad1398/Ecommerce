import type { Request, Response, NextFunction } from "express";
import Product from "../../models/Product.js";

type AuthenticatedVendorRequest = Request & {
  user?: { vendorID?: string };
};

export const getVendorProducts = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const vendorID = (req as AuthenticatedVendorRequest).user?.vendorID;
    const products = await Product.find({
      vendorId: vendorID,
      isDeleted: false,
    })
      .populate("categoryID", "name")
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, products });
  } catch (error) {
    return next(error);
  }
};
