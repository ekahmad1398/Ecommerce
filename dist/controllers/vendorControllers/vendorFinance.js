import mongoose from "mongoose";
import suborder from "../../models/orderItems.js";
export const getVendorFinancialStatus = async (req, res, next) => {
    try {
        const vendorID = req.user.vendorID;
        const vendorObjectId = mongoose.isValidObjectId(String(vendorID))
            ? new mongoose.Types.ObjectId(String(vendorID))
            : vendorID;
        const range = req.query.range ?? null;
        const startDate = new Date();
        const previousStartDate = new Date();
        let GroupStageID = {};
        if (range === "7Days" || range === "30Days" || range === "90Days") {
            const days = range === "7Days" ? 7 : range === "30Days" ? 30 : 90;
            startDate.setDate(startDate.getDate() - days);
            previousStartDate.setDate(previousStartDate.getDate() - days * 2);
            GroupStageID = {
                year: { $year: "$createdAt" },
                month: { $month: "$createdAt" },
                day: { $dayOfMonth: "$createdAt" },
            };
        }
        else if (range === "6Months") {
            startDate.setMonth(startDate.getMonth() - 6);
            previousStartDate.setMonth(previousStartDate.getMonth() - 12);
            GroupStageID = {
                year: { $year: "$createdAt" },
                month: { $month: "$createdAt" },
            };
        }
        else if (range === "1Year") {
            startDate.setFullYear(startDate.getFullYear() - 1);
            previousStartDate.setFullYear(previousStartDate.getFullYear() - 2);
            GroupStageID = {
                year: { $year: "$createdAt" },
                month: { $month: "$createdAt" },
            };
        }
        else if (range === "15Days") {
            startDate.setDate(startDate.getDate() - 15);
            previousStartDate.setDate(previousStartDate.getDate() - 30);
            GroupStageID = {
                year: { $year: "$createdAt" },
                month: { $month: "$createdAt" },
                day: { $dayOfMonth: "$createdAt" },
            };
        }
        else if (range === "1Month") {
            startDate.setDate(startDate.getDate() - 30);
            previousStartDate.setDate(previousStartDate.getDate() - 60);
            GroupStageID = {
                year: { $year: "$createdAt" },
                month: { $month: "$createdAt" },
                day: { $dayOfMonth: "$createdAt" },
            };
        }
        else {
            previousStartDate.setFullYear(2026);
            startDate.setFullYear(2026);
            GroupStageID = {};
        }
        const SalesData = await suborder.aggregate([
            {
                $match: {
                    vendorID: vendorObjectId,
                    createdAt: { $gte: previousStartDate },
                },
            },
            {
                $facet: {
                    totalcurrentSales: [
                        {
                            $match: {
                                createdAt: { $gte: startDate },
                            },
                        },
                        {
                            $group: {
                                _id: GroupStageID,
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
                            },
                        },
                    ],
                    totalsPreviousSales: [
                        {
                            $match: {
                                createdAt: { $gte: previousStartDate, $lte: startDate },
                            },
                        },
                        {
                            $group: {
                                _id: GroupStageID,
                                totalGrossSales: { $sum: "$subOrderTotal" },
                                totalNetEarnings: { $sum: "$vendorNetEarned" },
                                totalOrders: { $sum: 1 },
                                pendingOrders: {
                                    $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
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
                        { $match: { payoutReleaseDate: { $lte: Date.now() } } },
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
                            $unwind: {
                                path: "$productData",
                                preserveNullAndEmptyArrays: true,
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
                                "productData.name": 1,
                                platformComissionCut: 1,
                            },
                        },
                    ],
                },
            },
        ]);
        const result = SalesData[0] ?? { totalcurrentSales: [], totalsPreviousSales: [], LastpaidOrders: [] };
        res.status(200).json({
            success: true,
            lastPaidOrders: result.LastpaidOrders,
            current: result.totalcurrentSales,
            previous: result.totalsPreviousSales,
        });
    }
    catch (error) {
        next(error);
    }
};
