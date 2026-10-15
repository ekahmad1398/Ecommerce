import orderItems from "../../models/orderItems.js";
import user from "../../models/User.js";
import vendor from "../../models/vendor.js";
export const getAdminDashboard = async (req, res, next) => {
    try {
        const [dashboardData, totalCustomers, totalActiveVendors, pendingVendors] = await Promise.all([
            orderItems.aggregate([
                {
                    $match: {
                        status: { $in: ["processing", "shipped", "delivered"] },
                    },
                },
                {
                    $facet: {
                        financialStatus: [
                            {
                                $group: {
                                    _id: null,
                                    totalGMV: {
                                        $sum: "$subOrderTotal",
                                    },
                                    totalPlatformRevenue: { $sum: "$platformComissionCut" },
                                },
                            },
                        ],
                        pendingPayout: [
                            {
                                $match: {
                                    releasepayoutDate: { $gte: Date.now() },
                                },
                            },
                            {
                                $group: {
                                    _id: null,
                                    PendingPayoutMoney: { $sum: "$vendorNetEarned" },
                                },
                            },
                        ],
                        monthlyRevenueChart: [
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
                        VendorPayout: [
                            {
                                $match: {
                                    payoutReleaseDate: { $gte: "$payoutReleaseDate" },
                                },
                            },
                            { $sort: { payoutReleaseDate: 1 } },
                            {
                                $limit: 5,
                            },
                            {
                                $group: {
                                    _id: "$vendorID",
                                    VendorPayoutMoney: { $sum: "$vendorNetEarned" },
                                },
                            },
                            {
                                $lookup: {
                                    from: "vendor",
                                    localField: "_id",
                                    foreignField: "_id",
                                    as: "vendorData",
                                },
                            },
                            {
                                $unwind: "$vendorData",
                            },
                            {
                                $project: {
                                    companyName: 1,
                                    Companyimage: 1,
                                    VendorPayoutMoney: 1,
                                    "$vendorData.userid": 1,
                                    "$vendorData.country": 1,
                                },
                            },
                        ],
                    },
                },
            ]),
            user.countDocuments({ role: "user" }),
            vendor.countDocuments({
                status: "active",
            }),
            vendor
                .find({ status: "pending" })
                .select("name companyName createdAt")
                .sort({ createdAt: 1 })
                .limit(5),
        ]);
        const financialSummary = dashboardData?.[0]?.financialStatus ?? {
            totalGMV: 0,
            totalPlatformRevenue: 0,
            averageOrderValue: 0,
        };
        const gmv = financialSummary.totalGMV;
        const PlatformRevenue = financialSummary.totalPlatformRevenue;
        res.status(200).json({
            success: true,
            summary: {
                grossMerchandizeValue: gmv,
                activeVendorCount: totalActiveVendors,
                PlatformRevenue,
                registeredCustomerCount: totalCustomers,
            },
            PendingVendors: pendingVendors,
            chartData: dashboardData?.[0]?.monthlyRevenueChart,
            pendingPayout: dashboardData?.[0]?.pendingPayout,
        });
    }
    catch (error) {
        next(error);
    }
};
