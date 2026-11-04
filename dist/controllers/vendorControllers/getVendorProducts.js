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
export const getVendorProducts = async (req, res, next) => {
    try {
        const vendorID = req.user?.vendorID;
        if (!vendorID || !mongoose.isValidObjectId(vendorID)) {
            return res.status(401).json({
                success: false,
                message: "A valid vendor account is required.",
            });
        }
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
        const searchRegex = search ? new RegExp(escapeRegex(search), "i") : null;
        const vendorObjectId = new mongoose.Types.ObjectId(vendorID);
        const [matchingCount] = await Product.aggregate([
            { $match: { vendorId: vendorObjectId, isDeleted: { $ne: true } } },
            {
                $lookup: {
                    from: category.collection.name,
                    localField: "categoryID",
                    foreignField: "_id",
                    as: "category",
                },
            },
            ...(searchRegex
                ? [
                    {
                        $match: {
                            $or: [
                                { name: searchRegex },
                                { brand: searchRegex },
                                { sku: searchRegex },
                                { "category.name": searchRegex },
                            ],
                        },
                    },
                ]
                : []),
            { $count: "total" },
        ]);
        const totalMatches = matchingCount?.total ?? 0;
        const totalPages = Math.max(1, Math.ceil(totalMatches / limit));
        const skipped = Math.min(requestedOffset, (totalPages - 1) * limit);
        const currentPage = Math.floor(skipped / limit) + 1;
        const [result] = await Product.aggregate([
            {
                $match: {
                    vendorId: vendorObjectId,
                    isDeleted: { $ne: true },
                },
            },
            {
                $facet: {
                    products: [
                        {
                            $lookup: {
                                from: category.collection.name,
                                localField: "categoryID",
                                foreignField: "_id",
                                as: "category",
                            },
                        },
                        ...(searchRegex
                            ? [
                                {
                                    $match: {
                                        $or: [
                                            { name: searchRegex },
                                            { brand: searchRegex },
                                            { sku: searchRegex },
                                            { "category.name": searchRegex },
                                        ],
                                    },
                                },
                            ]
                            : []),
                        { $sort: { createdAt: -1, _id: -1 } },
                        { $skip: skipped },
                        { $limit: limit },
                        {
                            $set: {
                                categoryID: {
                                    $ifNull: [
                                        { $arrayElemAt: ["$category", 0] },
                                        "$categoryID",
                                    ],
                                },
                            },
                        },
                        { $unset: "category" },
                    ],
                    summary: [
                        {
                            $group: {
                                _id: null,
                                totalProducts: { $sum: 1 },
                                totalStock: { $sum: "$stock" },
                                archivedProducts: {
                                    $sum: {
                                        $cond: [{ $eq: ["$status", "archieved"] }, 1, 0],
                                    },
                                },
                                lowStockProducts: {
                                    $sum: { $cond: [{ $lt: ["$stock", 10] }, 1, 0] },
                                },
                            },
                        },
                        { $project: { _id: 0 } },
                    ],
                },
            },
        ]);
        const summary = result?.summary[0] ?? {
            totalProducts: 0,
            totalStock: 0,
            archivedProducts: 0,
            lowStockProducts: 0,
        };
        return res.status(200).json({
            success: true,
            products: result?.products ?? [],
            summary,
            totalProducts: summary.totalProducts,
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
