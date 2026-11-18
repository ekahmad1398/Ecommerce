import { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import SubOrders from "../../models/orderItems.js";

const allowedStatuses = [
  "shipped",
  "delivered",
  "cancelled",
  "processing",
] as const;
type VendorOrderStatus = (typeof allowedStatuses)[number];

const orderPopulates = [
  { path: "ParentorderID", select: "shippingAddress createdAt" },
  { path: "customerID", select: "name" },
  { path: "items.productID", select: "name sku" },
];

export const getVendorsOrders = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const vendorID = (req as any).user.vendorID;
    const search =
      (req.query.search as string | undefined)?.trim() ?? "";

    // ID lookup path: search by order id (full or partial)
    if (search) {
      let order: any = null;

      if (mongoose.isValidObjectId(search)) {
        order = await SubOrders.findOne({ _id: search, vendorID })
          .populate(orderPopulates)
          .lean();
      } else {
        const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const [match] = await SubOrders.aggregate([
          {
            $match: {
              vendorID: mongoose.isValidObjectId(String(vendorID))
                ? new mongoose.Types.ObjectId(String(vendorID))
                : vendorID,
            },
          },
          { $addFields: { idString: { $toString: "$_id" } } },
          { $match: { idString: { $regex: escaped, $options: "i" } } },
          { $limit: 1 },
          { $project: { _id: 1 } },
        ]);
        if (match) {
          order = await SubOrders.findById(match._id)
            .populate(orderPopulates)
            .lean();
        }
      }

      return res.status(200).json({
        success: true,
        orders: order ? [order] : [],
        totalOrders: order ? 1 : 0,
        currentPage: 1,
        totalPages: 1,
      });
    }

    const limit = Math.min(Math.max(Number(req.query.limit ?? 10), 1), 50);
    const statusQuery = (req.query.status as string | undefined) ?? "all";
    const status = allowedStatuses.includes(statusQuery as VendorOrderStatus)
      ? (statusQuery as VendorOrderStatus)
      : null;

    const filter: Record<string, unknown> = { vendorID };
    filter.status = status ?? { $ne: "pending" };

    const totalOrders = await SubOrders.countDocuments(filter);
    const totalPages = Math.max(Math.ceil(totalOrders / limit), 1);
    const page = Math.min(Math.max(Number(req.query.page ?? 1), 1), totalPages);
    const skip = (page - 1) * limit;

    const orders = await SubOrders.find(filter)
      .populate(orderPopulates)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.status(200).json({
      success: true,
      orders,
      totalOrders,
      currentPage: page,
      totalPages,
    });
  } catch (error) {
    next(error);
  }
};

export const UpdateSubOrderStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const vendorID = (req as any).user.vendorID;
    const productID = req.params.id;
    const status = req.body.status;
    const allowedStatus = ["processing", "shipped", "delivered"];

    if (!allowedStatus.includes(status)) {
      return res
        .status(400)
        .json({ success: false, message: "invalid status." });
    }

    const suborderData = await SubOrders.findOne({
      _id: productID,
      vendorID,
    }).select("status items createdAt updatedAt subOrderTotal");

    if (!suborderData) {
      return res.status(400).json({
        success: false,
        message: "the order not found or does not belong to.",
      });
    }

    suborderData.status = status;
    await suborderData.save();

    return res.status(200).json({
      success: true,
      message: `order status updated to ${status} successfully`,
      suborderData,
    });
  } catch (error) {
    next(error);
  }
};
