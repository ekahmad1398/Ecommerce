import orderItems from "../../models/orderItems.js";
import user from "../../models/User.js";
import vendor from "../../models/vendor.js";
const RANGE_MONTHS = {
    "3Months": 3,
    "6Months": 6,
    "12Months": 12,
};
export const getAdminDashboard = async (req, res, next) => {
    try {
        const rangeParam = typeof req.query.range === "string" ? req.query.range : "";
        const months = RANGE_MONTHS[rangeParam] ?? 12;
        const now = new Date();
        const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));
        const previousPeriodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (2 * months - 1), 1));
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
                                $match: {
                                    createdAt: { $gte: periodStart },
                                },
                            },
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
                                    payoutReleaseDate: { $gte: new Date() },
                                    isPaidOutToVendor: { $ne: true },
                                    status: { $in: ["delivered"] },
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
                                $match: {
                                    createdAt: { $gte: periodStart },
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
                            { $limit: months },
                        ],
                        previousMonthlyRevenueChart: [
                            {
                                $match: {
                                    createdAt: {
                                        $gte: previousPeriodStart,
                                        $lt: periodStart,
                                    },
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
                            { $limit: months },
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
        const financialSummary = dashboardData?.[0]?.financialStatus?.[0] ?? {
            totalGMV: 0,
            totalPlatformRevenue: 0,
        };
        const gmv = financialSummary.totalGMV;
        const PlatformRevenue = financialSummary.totalPlatformRevenue;
        res.status(200).json({
            success: true,
            range: rangeParam && RANGE_MONTHS[rangeParam] ? rangeParam : "12Months",
            summary: {
                grossMerchandizeValue: gmv,
                activeVendorCount: totalActiveVendors,
                PlatformRevenue,
                registeredCustomerCount: totalCustomers,
            },
            PendingVendors: pendingVendors,
            chartData: dashboardData?.[0]?.monthlyRevenueChart,
            previousChartData: dashboardData?.[0]?.previousMonthlyRevenueChart,
            pendingPayout: dashboardData?.[0]?.pendingPayout,
        });
    }
    catch (error) {
        next(error);
    }
};
