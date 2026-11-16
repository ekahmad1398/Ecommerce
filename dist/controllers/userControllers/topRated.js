import mongoose from "mongoose";
import category from "../../models/category.js";
import ProductSchema from "../../models/Product.js";
const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 50;
const DEFAULT_MIN_RATING = 4;
const MIN_REVIEW_COUNT = 3;
const PRIOR_WEIGHT = 10;
const PRIOR_MEAN = 3.5;
const numericQuery = (value) => {
    if (typeof value !== "string" || !value.trim())
        return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
};
export const topRated = async (req, res, next) => {
    try {
        const brand = typeof req.query.brand === "string"
            ? req.query.brand.trim().slice(0, 100)
            : "";
        const categoryValue = typeof req.query.category === "string" ? req.query.category.trim() : "";
        if (categoryValue && !mongoose.isValidObjectId(categoryValue)) {
            return res.status(400).json({
                success: false,
                message: "The selected category is invalid.",
            });
        }
        const selectedCategoryId = categoryValue
            ? new mongoose.Types.ObjectId(categoryValue)
            : null;
        const limitParam = numericQuery(req.query.limit);
        const pageParam = numericQuery(req.query.page);
        const limit = Math.min(Math.max(Math.floor(limitParam ?? DEFAULT_LIMIT), 1), MAX_LIMIT);
        const page = Math.max(Math.floor(pageParam ?? 1), 1);
        const skip = (page - 1) * limit;
        if (!Number.isSafeInteger(skip)) {
            return res.status(400).json({
                success: false,
                message: "The requested page is too large.",
            });
        }
        const collectionName = category.collection.name;
        const eligibleMatch = {
            status: "active",
            isDeleted: { $ne: true },
            rating: { $gte: DEFAULT_MIN_RATING },
            reviewCount: { $gte: MIN_REVIEW_COUNT },
        };
        const productMatch = { ...eligibleMatch };
        if (selectedCategoryId)
            productMatch.categoryID = selectedCategoryId;
        if (brand)
            productMatch.brand = brand;
        const facetMatch = { ...eligibleMatch };
        if (selectedCategoryId)
            facetMatch.categoryID = selectedCategoryId;
        const [levelThreeCategories, [result]] = await Promise.all([
            category.aggregate([
                { $match: { parentCategory: { $ne: null } } },
                {
                    $lookup: {
                        from: collectionName,
                        localField: "parentCategory",
                        foreignField: "_id",
                        as: "parent",
                    },
                },
                { $match: { "parent.0.parentCategory": { $ne: null } } },
                { $sort: { name: 1 } },
                {
                    $project: {
                        _id: 0,
                        id: { $toString: "$_id" },
                        name: 1,
                    },
                },
            ]),
            ProductSchema.aggregate([
                {
                    $facet: {
                        products: [
                            { $match: productMatch },
                            {
                                $addFields: {
                                    bayesScore: {
                                        $divide: [
                                            {
                                                $add: [
                                                    { $multiply: ["$rating", "$reviewCount"] },
                                                    PRIOR_WEIGHT * PRIOR_MEAN,
                                                ],
                                            },
                                            { $add: ["$reviewCount", PRIOR_WEIGHT] },
                                        ],
                                    },
                                },
                            },
                            { $sort: { bayesScore: -1, reviewCount: -1, _id: 1 } },
                            { $skip: skip },
                            { $limit: limit },
                            {
                                $lookup: {
                                    from: collectionName,
                                    localField: "categoryID",
                                    foreignField: "_id",
                                    as: "categoryInfo",
                                },
                            },
                            {
                                $addFields: {
                                    categoryInfo: { $arrayElemAt: ["$categoryInfo", 0] },
                                },
                            },
                            {
                                $project: {
                                    _id: 0,
                                    id: { $toString: "$_id" },
                                    name: 1,
                                    brand: 1,
                                    price: 1,
                                    discount: 1,
                                    stock: 1,
                                    rating: 1,
                                    reviewCount: 1,
                                    color: { $ifNull: [{ $arrayElemAt: ["$colors", 0] }, ""] },
                                    category: "$categoryInfo.name",
                                    images: {
                                        $map: {
                                            input: { $ifNull: ["$images", []] },
                                            as: "image",
                                            in: "$$image.publicId",
                                        },
                                    },
                                },
                            },
                        ],
                        total: [{ $match: productMatch }, { $count: "totalProducts" }],
                        brands: [
                            {
                                $match: {
                                    ...facetMatch,
                                    brand: { $exists: true, $nin: [null, ""] },
                                },
                            },
                            { $group: { _id: "$brand", count: { $sum: 1 } } },
                            { $sort: { count: -1, _id: 1 } },
                            { $limit: 20 },
                            {
                                $project: {
                                    _id: 0,
                                    name: "$_id",
                                    count: 1,
                                },
                            },
                        ],
                    },
                },
            ]),
        ]);
        const departments = levelThreeCategories.map((entry) => ({
            id: entry.id,
            name: entry.name,
        }));
        const totalProducts = result?.total?.[0]?.totalProducts ?? 0;
        res.status(200).json({
            success: true,
            minRating: DEFAULT_MIN_RATING,
            currentPage: page,
            totalPages: Math.max(1, Math.ceil(totalProducts / limit)),
            totalProducts,
            products: result?.products ?? [],
            departments,
            brands: result?.brands ?? [],
        });
    }
    catch (error) {
        next(error);
    }
};
