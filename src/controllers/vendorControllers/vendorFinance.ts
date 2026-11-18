import type { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import suborder from "../../models/orderItems.js";

const startOfDay = (date: Date) =>
  new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));

const daysAgo = (days: number) =>
  startOfDay(new Date(Date.now() - days * 24 * 60 * 60 * 1000));

export const getVendorFinancialStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const vendorID = (req as any).user.vendorID;
    const vendorObjectId = mongoose.isValidObjectId(String(vendorID))
      ? new mongoose.Types.ObjectId(String(vendorID))
      : vendorID;
    const range =
      (req.query.range as
        | "7Days"
        | "15Days"
        | "30Days"
        | "90Days"
        | "1Month"
        | "6Months"
        | "1Year"
        | null) ?? null;

    let startDate: Date;
    let previousStartDate: Date;
    let groupStageID: Record<string, any> = {};
    const dailyGroup = {
      year: { $year: "$createdAt" },
      month: { $month: "$createdAt" },
      day: { $dayOfMonth: "$createdAt" },
    };
    const monthlyGroup = {
      year: { $year: "$createdAt" },
      month: { $month: "$createdAt" },
    };

    if (range === "7Days" || range === "30Days" || range === "90Days") {
      const days = range === "7Days" ? 7 : range === "30Days" ? 30 : 90;
      startDate = daysAgo(days);
      previousStartDate = daysAgo(days * 2);
      groupStageID = dailyGroup;
    } else if (range === "15Days") {
      startDate = daysAgo(15);
      previousStartDate = daysAgo(30);
      groupStageID = dailyGroup;
    } else if (range === "1Month") {
      startDate = daysAgo(30);
      previousStartDate = daysAgo(60);
      groupStageID = dailyGroup;
    } else if (range === "6Months") {
      startDate = daysAgo(183);
      previousStartDate = daysAgo(366);
      groupStageID = monthlyGroup;
    } else if (range === "1Year") {
      startDate = daysAgo(365);
      previousStartDate = daysAgo(730);
      groupStageID = monthlyGroup;
    } else {
      startDate = startOfDay(new Date(0));
      previousStartDate = startOfDay(new Date(0));
    }

    const salesMatch = {
      vendorID: vendorObjectId,
      createdAt: { $gte: previousStartDate },
    };

    const groupFields = {
      totalGrossSales: { $sum: "$subOrderTotal" },
      totalNetEarnings: { $sum: "$vendorNetEarned" },
      totalOrders: { $sum: 1 },
      processingOrders: {
        $sum: { $cond: [{ $eq: ["$status", "processing"] }, 1, 0] },
      },
      deliveredOrders: {
        $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] },
      },
      cancelledOrders: {
        $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] },
      },
    };

    const [salesData, lastPaidOrders] = await Promise.all([
      suborder.aggregate([
        { $match: salesMatch },
        {
          $facet: {
            totalcurrentSales: [
              { $match: { createdAt: { $gte: startDate } } },
              { $group: { _id: groupStageID, ...groupFields } },
            ],
            totalsPreviousSales: [
              {
                $match: {
                  createdAt: { $gte: previousStartDate, $lt: startDate },
                },
              },
              {
                $group: {
                  _id: groupStageID,
                  ...groupFields,
                  pendingOrders: {
                    $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
                  },
                },
              },
            ],
          },
        },
      ]),
      suborder.aggregate([
        {
          $match: {
            vendorID: vendorObjectId,
            payoutReleaseDate: { $lte: new Date() },
            isPaidOutToVendor: { $ne: true },
            // status: "delivered",
          },
        },
        { $sort: { createdAt: -1 } },
        { $limit: 15 },
        {
          $lookup: {
            from: "products",
            localField: "items.productID",
            foreignField: "_id",
            as: "productData",
          },
        },
        {
          $project: {
            items: 1,
            vendorNetEarned: 1,
            isPaidOutToVendor: 1,
            subOrderTotal: 1,
            createdAt: 1,
            updatedAt: 1,
            payoutReleaseDate: 1,
            productNames: "$productData.name",
            platformComissionCut: 1,
          },
        },
      ]),
    ]);

    const result = salesData[0] ?? {
      totalcurrentSales: [],
      totalsPreviousSales: [],
    };

    res.status(200).json({
      success: true,
      lastPaidOrders,
      current: result.totalcurrentSales,
      previous: result.totalsPreviousSales,
    });
  } catch (error) {
    next(error);
  }
};
