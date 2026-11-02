import type { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import Product from "../../models/Product.js";
import category from "../../models/category.js";

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

    const [result] = await Product.aggregate([
      {
        $match: {
          vendorId: new mongoose.Types.ObjectId(vendorID),
          isDeleted: { $ne: true },
        },
      },
      {
        $facet: {
          products: [
            { $sort: { createdAt: -1 } },
            {
              $lookup: {
                from: category.collection.name,
                let: { categoryID: "$categoryID" },
                pipeline: [
                  { $match: { $expr: { $eq: ["$_id", "$$categoryID"] } } },
                  { $project: { _id: 1, name: 1 } },
                ],
                as: "category",
              },
            },
            {
              $set: {
                categoryID: {
                  $ifNull: [
                    { $arrayElemAt: ["$category", 0] },
                    "$categoryID",
                  ],
                },
              },
            },
            { $unset: "category" },
          ],
          summary: [
            {
              $group: {
                _id: null,
                totalProducts: { $sum: 1 },
                totalStock: { $sum: "$stock" },
                archivedProducts: {
                  $sum: {
                    $cond: [{ $eq: ["$status", "archieved"] }, 1, 0],
                  },
                },
                lowStockProducts: {
                  $sum: { $cond: [{ $lt: ["$stock", 10] }, 1, 0] },
                },
              },
            },
            { $project: { _id: 0 } },
          ],
        },
      },
    ]);

    const summary = result?.summary[0] ?? {
      totalProducts: 0,
      totalStock: 0,
      archivedProducts: 0,
      lowStockProducts: 0,
    };

    return res.status(200).json({
      success: true,
      products: result?.products ?? [],
      summary,
    });
  } catch (error) {
    return next(error);
  }
};
