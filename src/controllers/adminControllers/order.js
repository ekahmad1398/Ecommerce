import order from "../../models/Order.js";
import orderitems from "../../models/orderItems.js";
export const getAdminOrderFeed = async (req, res, next) => {
  try {
    const totalOrders = await order.countDocuments();
    const limit = Math.min(Math.max(Number(req.query.limit || 10, 1)), 50);
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

export const getVendorBalanceLedger = async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit || 10, 1)), 50);
    const ledgerBalance = await orderitems.aggregate([
      {
        $match: {
          itemsStatus: { $in: ["shipped", "delivered", "processing"] },
        },
      },
      {
        $group: {
          _id: "$vendorID",
          totalGrossSales: { $sum: { $multiply: ["quantity", "price"] } },
          totalVendorNetEarning: { $sum: "$vendorNetEarned" },
          totalPlatfromCommision: { $sum: "$platformComissionCut" },
        },
      },
      {
        $sort: {
          totalVendorNetEarning: -1,
        },
      },
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
      {
        $facet: {
          metaData: [{ $count: "totalVendors" }],
          ledgerData: [{ $skip: skip }, { $limit: limit }],
        },
      },
    ]);
    const vendors = ledgerBalance.ledgerData ?? [];
    const totalVendors = ledgerBalance.metaData.totalVendors;
    const totalPages = Math.ceil(totalVendors / limit);
    const page = Math.min(Math.max(Number(req.query.page) || 1, 1), totalPages);
    const skip = (page - 1) * limit;

    res.status(200).json({
      success: true,
    });
  } catch (error) {
    next(error);
  }
};
