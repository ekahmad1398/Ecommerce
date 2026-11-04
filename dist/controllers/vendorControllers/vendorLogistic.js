import mongoose from "mongoose";
import Product from "../../models/Product.js";
import category from "../../models/category.js";
const getPositiveInteger = (value, fallback, maximum) => {
    const parsed = Number(value);
    return Number.isFinite(parsed)
        ? Math.min(Math.max(Math.floor(parsed), 1), maximum)
        : fallback;
};
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export const getvendorLogisticData = async (req, res, next) => {
    try {
        const vendorID = req.user?.vendorID;
        if (!vendorID || !mongoose.isValidObjectId(vendorID)) {
            return res.status(401).json({
                success: false,
                message: "A valid vendor account is required.",
            });
        }
        const vendorObjectId = new mongoose.Types.ObjectId(vendorID);
        const limit = getPositiveInteger(req.query.limit, 10, 50);
        const requestedPage = getPositiveInteger(req.query.page, 1, Number.MAX_SAFE_INTEGER);
        const requestedSkip = req.query.skip === undefined ? undefined : Number(req.query.skip);
        if (requestedSkip !== undefined &&
            (!Number.isSafeInteger(requestedSkip) || requestedSkip < 0)) {
            return res.status(400).json({
                success: false,
                message: "Skip must be a non-negative safe integer.",
            });
        }
        const requestedOffset = requestedSkip ?? (requestedPage - 1) * limit;
        const search = typeof req.query.search === "string"
            ? req.query.search.trim().slice(0, 100)
            : "";
        const matchCriteria = {
            vendorId: vendorObjectId,
            status: "active",
            isDeleted: { $ne: true },
        };
        const totalProducts = await Product.countDocuments(matchCriteria);
        const searchCriteria = search
            ? {
                $or: [
                    { name: { $regex: escapeRegex(search), $options: "i" } },
                    { brand: { $regex: escapeRegex(search), $options: "i" } },
                    { sku: { $regex: escapeRegex(search), $options: "i" } },
                    { "categoryInfo.name": { $regex: escapeRegex(search), $options: "i" } },
                ],
            }
            : {};
        const [matchingCount] = await Product.aggregate([
            { $match: matchCriteria },
            {
                $lookup: {
                    from: category.collection.name,
                    localField: "categoryID",
                    foreignField: "_id",
                    as: "categoryInfo",
                },
            },
            { $match: searchCriteria },
            { $count: "total" },
        ]);
        const totalMatches = matchingCount?.total ?? 0;
        const totalPages = Math.max(1, Math.ceil(totalMatches / limit));
        const skipped = Math.min(requestedOffset, (totalPages - 1) * limit);
        const currentPage = Math.floor(skipped / limit) + 1;
        const [stockData] = await Product.aggregate([
            { $match: matchCriteria },
            {
                $lookup: {
                    from: category.collection.name,
                    localField: "categoryID",
                    foreignField: "_id",
                    as: "categoryInfo",
                },
            },
            {
                $facet: {
                    products: [
                        { $match: searchCriteria },
                        { $sort: { stock: 1, name: 1 } },
                        { $skip: skipped },
                        { $limit: limit },
                        {
                            $unwind: {
                                path: "$categoryInfo",
                                preserveNullAndEmptyArrays: true,
                            },
                        },
                        {
                            $project: {
                                name: 1,
                                sku: 1,
                                stock: 1,
                                status: 1,
                                thumbnailImage: { $arrayElemAt: ["$images", 0] },
                                Category: { $ifNull: ["$categoryInfo.name", "Uncategorized"] },
                                discount: 1,
                                rating: 1,
                            },
                        },
                    ],
                    statuses: [
                        {
                            $group: {
                                _id: null,
                                urgentCount: {
                                    $sum: { $cond: [{ $lte: ["$stock", 5] }, 1, 0] },
                                },
                                mediumCount: {
                                    $sum: {
                                        $cond: [
                                            {
                                                $and: [
                                                    { $gt: ["$stock", 5] },
                                                    { $lte: ["$stock", 15] },
                                                ],
                                            },
                                            1,
                                            0,
                                        ],
                                    },
                                },
                                healthyCount: {
                                    $sum: { $cond: [{ $gt: ["$stock", 15] }, 1, 0] },
                                },
                            },
                        },
                        { $project: { _id: 0 } },
                    ],
                },
            },
        ]);
        return res.status(200).json({
            success: true,
            products: stockData?.products ?? [],
            statuses: stockData?.statuses[0] ?? {
                urgentCount: 0,
                mediumCount: 0,
                healthyCount: 0,
            },
            totalProducts,
            totalMatches,
            currentPage,
            totalPages,
            skipped,
            limit,
        });
    }
    catch (error) {
        return next(error);
    }
};
