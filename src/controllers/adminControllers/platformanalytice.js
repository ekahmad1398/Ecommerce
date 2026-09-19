import orderItems from "../../models/orderItems.js";
import user from "../../models/User.js";
import vendor from "../../models/vendor.js";
export const getAdminDashboard = async (req, res, next) => {
  try {
    const piplineForFinance = await orderItems.aggregate([
      {
        $facet: {
          financialStats: [
            {
              $match: {
                status: { $in: ["processing", "shipped", "delivered"] },
              },
            },
            {
              $group: {
                _id: null,
                totalGMV: { $sum: { $multiply: ["quantity", "price"] } },
                totalPlatformRevenue: { $sum: "$platformComissionCut" },
              },
            },
          ],
          monthlyRevenueChart: [
            {
              $match: {
                status: { $in: ["processing", "shipped", "delivered"] },
              },
            },
            {
              $group: {
                _id: {
                  year: { $year: "$createdAt" },
                  month: { $month: "$createdAt" },
                },
                monthlyEarning: { $sum: "$platformComissionCut" },
              },
            },
            { $sort: { "_id.year": -1, "_id.month": -1 } },
            { $limit: 12 },
          ],
        },
      },
    ]);
    const gmv = piplineForFinance.financialStats.totalGMV || 0;
    const PlatformRevenue =
      piplineForFinance.financialStats.totalPlatformRevenue || 0;
    const totalCustomers = await user.countDocuments({ role: "user" });
    const totalActiveVendors = await vendor.countDocuments({
      status: "active",
    });

    res.status(200).json({
      success: true,
      summary: {
        grossMerchandizeValue: gmv,
        activeVendorCount:totalActiveVendors,
        PlatformRevenue,
        registeredCustomerCount:totalCustomers
      },
      chartData:piplineForFinance
    });
  } catch (error) {
    next(error);
  }
};
