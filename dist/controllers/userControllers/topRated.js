import mongoose from "mongoose";
import category from "../../models/category.js";
import ProductSchema from "../../models/Product.js";
const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 50;
const DEFAULT_MIN_RATING = 4;
const MIN_REVIEW_COUNT = 3;
// Bayesian average: (rating * reviews + priorWeight * priorMean) / (reviews + priorWeight)
// pulls products with few reviews toward ~3.5 so one great review can't top the list
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
        const brand = typeof req.query.brand === "string" ? req.query.brand.trim().slice(0, 100) : "";
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
        const levelThreeCategories = await category.aggregate([
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
        ]);
        // one pass over eligible products -> per-category counts, merged in JS
        const categoryCounts = await ProductSchema.aggregate([
            { $match: eligibleMatch },
            { $group: { _id: "$categoryID", count: { $sum: 1 } } },
        ]);
        const countByCategory = new Map(categoryCounts.map((row) => [String(row._id), row.count]));
        const departments = levelThreeCategories.map((entry) => ({
            id: entry.id,
            name: entry.name,
            count: countByCategory.get(entry.id) ?? 0,
        }));
        // resolve selected level-3 category -> itself + any children, once
        let categoryIds = null;
        if (selectedCategoryId) {
            const children = await category
                .find({ parentCategory: selectedCategoryId })
                .select("_id")
                .lean();
            categoryIds = [
                selectedCategoryId,
                ...children.map((c) => c._id),
            ];
        }
        // full product filter (products + total facets only)
        const productMatch = { ...eligibleMatch };
        if (categoryIds)
            productMatch.categoryID = { $in: categoryIds };
        if (brand)
            productMatch.brand = brand;
        // facet filters: scoped to the selected category but NOT the selected
        // brand, so the brand list doesn't collapse to the chosen brand
        const facetMatch = { ...eligibleMatch };
        if (categoryIds)
            facetMatch.categoryID = { $in: categoryIds };
        const [result] = await ProductSchema.aggregate([
            {
                $facet: {
                    // cheap path: filter + sort + paginate FIRST, lookup only the page
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
                        { $match: { ...facetMatch, brand: { $exists: true, $nin: [null, ""] } } },
                        { $group: { _id: "$brand", count: { $sum: 1 } } },
                        { $sort: { count: -1, _id: 1 } },
                        { $limit: 50 },
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
        ]);
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
