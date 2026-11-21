import type { NextFunction, Request, Response } from "express";
import orderItems from "../../models/orderItems.js";
import user from "../../models/User.js";
import vendor from "../../models/vendor.js";

interface monthlyRevenueChart {
  _id: {
    year: number;
    month: number;
    day?: number;
  };
  monthlyEarning: number;
}

interface financialStatus {
  totalGMV: number;
  totalPlatformRevenue: number;
}

interface aggregateResult {
  financialStatus: financialStatus[];
  pendingPayout: { PendingPayoutMoney: number }[];
  monthlyRevenueChart: monthlyRevenueChart[];
  previousMonthlyRevenueChart: monthlyRevenueChart[];
}

const RANGE_MONTHS: Record<string, number> = {
  "1Month": 1,
  "3Months": 3,
  "6Months": 6,
  "12Months": 12,
};

const DAY_MS = 24 * 60 * 60 * 1000;
const DAILY_RANGE_DAYS = 30;

export const getAdminDashboard = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const rangeParam = typeof req.query.range === "string" ? req.query.range : "";
    const months = RANGE_MONTHS[rangeParam] ?? 12;
    const isDailyRange = months === 1;
    const now = new Date();

    const periodStart = isDailyRange
      ? new Date(now.getTime() - DAILY_RANGE_DAYS * DAY_MS)
      : new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1),
        );
    const previousPeriodStart = isDailyRange
      ? new Date(now.getTime() - DAILY_RANGE_DAYS * 2 * DAY_MS)
      : new Date(
          Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth() - (2 * months - 1),
            1,
          ),
        );

    const chartGroupId = isDailyRange
      ? {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
          day: { $dayOfMonth: "$createdAt" },
        }
      : {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
        };
    const chartLimit = isDailyRange ? DAILY_RANGE_DAYS + 1 : months;
    const chartSort: Record<string, 1 | -1> = isDailyRange
      ? { "_id.year": -1, "_id.month": -1, "_id.day": -1 }
      : { "_id.year": -1, "_id.month": -1 };

    const [dashboardData, totalCustomers, totalActiveVendors, pendingVendors] =
      await Promise.all([
        orderItems.aggregate<aggregateResult>([
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
                    _id: chartGroupId,
                    monthlyEarning: { $sum: "$platformComissionCut" },
                  },
                },
                { $sort: chartSort },
                { $limit: chartLimit },
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
                    _id: chartGroupId,
                    monthlyEarning: { $sum: "$platformComissionCut" },
                  },
                },
                { $sort: chartSort },
                { $limit: chartLimit },
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
  } catch (error) {
    next(error);
  }
};
