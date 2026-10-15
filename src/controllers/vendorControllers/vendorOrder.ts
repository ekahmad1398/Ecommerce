import { NextFunction, Request, Response } from "express";
import SubOrders from "../../models/orderItems.js";

export const getVendorsOrders = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const vendorID = (req as any).user.vendorID;
    const totalOrders = await SubOrders.countDocuments({ vendorID });
    const limit = Math.min(Math.max(Number(req.query.limit ?? 10), 1), 50);
    const totalPages = Math.max(Math.ceil(totalOrders / limit), 1);
    const page = Math.min(Math.max(Number(req.query.page ?? 1), 1), totalPages);
    const skip = (page - 1) * limit;
    const allowedStatus = [
      "shipped",
      "delivered",
      "cancelled",
      "pending",
      "processing",
    ] as const;
    type VendorOrderStatus = (typeof allowedStatus)[number];
    const statusQuery = (req.query.status as string | undefined) ?? "pending";
    const status: VendorOrderStatus = allowedStatus.includes(
      statusQuery as VendorOrderStatus,
    )
      ? (statusQuery as VendorOrderStatus)
      : "pending";
    const subOrder = await SubOrders.find({ vendorID, status })
      .populate("ParentorderID", "shippingAddress createdAt customerID")
      .populate("items.productID", "name sku")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      currentPage: page,
      totalPages,
      subOrder,
      totalOrders,
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
    const allowedStatus = ["processing", "shipped", "delivered", "cancelled"];

    if (!allowedStatus.includes(status)) {
      return res.status(400).json({ success: false, message: "invalid status." });
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
