import suborder from "../../models/orderItems.js";
import Products from "../../models/Product.js";

export const getVendorFinancialStatus = async (req, res, next) => {
  try {
    const vendorID = req.user.vendorID;
    const range = req.query;
    const startDate = new Date();
    let GroupStageID = {};

    if (range === "6Months") {
      startDate.setMonth(startDate.getMonth() - 6);
      GroupStageID = {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" },
      };
    } else if (range === "1Year") {
      startDate.setFullYear(startDate.getFullYear() - 1);
      GroupStageID = {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" },
      };
    } else {
      startDate.setDate(startDate.getDate() - 30);
      GroupStageID = {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" },
        day: { $dayOfMonth: "$createdAt" },
      };
    }

    const SalesData = await suborder.aggregate([
      {
        $match: {
          vendorID,
          createdAt: { $gte: startDate },
        },
      },
      {
        $facet: {
          totalsOfSales: [
            {
              $group: {
                _id: GroupStageID,
                totalGrossSales: { $sum: "$subOrderTotal" },
                totalNetEarnings: { $sum: { $sum: "$vendorNetEarned" } },
                totalOrders: { $sum: 1 },
                pendingOrders: {
                  $sum: { $cond: [{ $eq: ["$status", "shipped"] }, 1, 0] },
                },
                processingOrders: {
                  $sum: { $cond: [{ $eq: ["$status", "processing"] }, 1, 0] },
                },
                deliveredOrders: {
                  $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] },
                },
                cancelledOrders: {
                  $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] },
                },
              },
            },
          ],
          LastpaidOrders: [
            { $match: { isPaidOutToVendor: true } },
            { $sort: { createdAt: -1 } },
            { $limit: 15 },
            {
              $lookup: {
                from: "product",
                localField: "items.productID",
                foreignField: "_id",
                as: "productData",
              },
            },
            { $unwind: "$productData" },
            {
              $project: {
                items: 1,
                vendorNetEarned: 1,
                isPaidOutToVendor: 1,
                subOrderTotal: 1,
                updateAt: 1,
                "productData.name": 1,
                platformComissionCut: 1,
              },
            },
          ],
        },
      },
    ]);

    res.status(200).json({
      success: true,
      LastOrders: SalesData.LastpaidOrders,
      data: SalesData.totalsOfSales,
    });
  } catch (error) {
    next(error);
  }
};
