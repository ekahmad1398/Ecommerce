import mongoose from "mongoose";
import category from "../../models/category.js";
import ProductSchema from "../../models/Product.js";
const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 50;
const MIN_DISCOUNT = 15;
const numericQuery = (value) => {
    if (typeof value !== "string" || !value.trim())
        return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
};
export const topDiscounts = async (req, res, next) => {
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
            discount: { $gte: MIN_DISCOUNT },
            stock: { $gt: 0 },
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
                                    savings: {
                                        $multiply: [
                                            "$price",
                                            { $divide: [{ $ifNull: ["$discount", 0] }, 100] },
                                        ],
                                    },
                                },
                            },
                            { $sort: { discount: -1, savings: -1, _id: 1 } },
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
                                    savings: 1,
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
            ]),
        ]);
        const departments = levelThreeCategories.map((entry) => ({
            id: entry.id,
            name: entry.name,
        }));
        const totalProducts = result?.total?.[0]?.totalProducts ?? 0;
        res.status(200).json({
            success: true,
            minDiscount: MIN_DISCOUNT,
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
