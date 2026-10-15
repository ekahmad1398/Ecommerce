import order from "../../models/Order.js";
import orderitems from "../../models/orderItems.js";
import type { Response, Request, NextFunction } from "express";

export const getAdminOrderFeed = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const totalOrders = await order.countDocuments();
    const limit = Math.min(Math.max(Number(req.query.limit || 10)), 50);
    const totalPages = Math.ceil(totalOrders / limit);
    const page = Math.min(Math.max(Number(req.query.page) || 1, 1), totalPages);
    const skip = (page - 1) * limit;
    const orders = await order
      .find()
      .populate("customerID", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      currentPage: page,
      totalPages,
      totalOrders,
      orders,
    });
  } catch (error) {
    next(error);
  }
};

export const getVendorBalanceLedger = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit || 10)), 50);
    const requestePage = Math.max(1, parseInt((req as any).query.page) || 1);
    const skip = (requestePage - 1) * limit;
    const [ledgerBalance] = await orderitems.aggregate([
      {
        $match: {
          status: { $in: ["shipped", "delivered", "processing"] },
        },
      },
      {
        $group: {
          _id: "$vendorID",
          totalGrossSales: { $sum: "$subOrderTotal" },
          totalVendorNetEarning: { $sum: "$vendorNetEarned" },
          totalPlatfromCommision: { $sum: "$platformComissionCut" },
          VendorOrderCount: { $sum: 1 },
        },
      },

      {
        $facet: {
          summaryStats: [
            {
              $group: {
                _id: null,
                totalVendors: { $sum: 1 },
                avgNetEarning: { $avg: "$totalVendorNetEarning" },
                TotalGrossEarnedFromVendors: {
                  $sum: "$totalPlatfromCommision",
                },
                TotalOrdersProcessed: { $sum: "$VendorOrderCount" },
              },
            },
            {
              $project: {
                _id: 0,
                totalVendors: 1,
                avgNetEarning: 1,
                TotalGrossEarnedFromVendors: 1,
                TotalOrdersProcessed: 1,
              },
            },
          ],
          ledgerData: [
            {
              $sort: {
                totalVendorNetEarning: -1,
              },
            },
            { $skip: skip },
            { $limit: limit },
            {
              $lookup: {
                from: "vendor",
                localField: "_id",
                foreignField: "_id",
                as: "VendorDetails",
              },
            },
            { $unwind: "$VendorDetails" },
            {
              $project: {
                _id: 0,
                vendorID: "$_id",
                BusinessName: "$VendorDetails.companyName",
                grossSales: "$totalGrossSales",
                vendorPayoutBalance: "$totalVendorNetEarning",
                platfromRevenue: "$totalPlatfromCommision",
              },
            },
          ],
        },
      },
    ]);
    const vendors = ledgerBalance?.ledgerData ?? [];
    const totalVendors = ledgerBalance?.summaryStats?.[0]?.totalVendors ?? 0;
    const totalPages = totalVendors > 0 ? Math.ceil(totalVendors / limit) : 1;
    const actualCurrentPage = Math.min(requestePage, totalPages);

    res.status(200).json({
      success: true,
      currentPage: actualCurrentPage,
      skip,
      totalPages,
      totalVendors,
      vendorsData: vendors,
    });
  } catch (error) {
    next(error);
  }
};
