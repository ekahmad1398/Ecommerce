import mongoose from "mongoose";
import category from "../../models/category.js";
import ProductSchema from "../../models/Product.js";
export const getHomeCategories = async (req, res, next) => {
    try {
        const requestedLimit = Number(req.query.limit);
        const requestedPage = Number(req.query.page);
        const limit = Number.isSafeInteger(requestedLimit) && requestedLimit > 0
            ? Math.min(requestedLimit, 50)
            : 10;
        const page = Number.isSafeInteger(requestedPage) && requestedPage > 0
            ? requestedPage
            : 1;
        const skip = (page - 1) * limit;
        if (!Number.isSafeInteger(skip)) {
            return res.status(400).json({
                success: false,
                message: "The requested page is too large.",
            });
        }
        const collectionName = category.collection.name;
        const [result] = await category.aggregate([
            { $match: { parentCategory: { $ne: null } } },
            {
                $lookup: {
                    from: collectionName,
                    localField: "parentCategory",
                    foreignField: "_id",
                    pipeline: [
                        { $match: { parentCategory: null } },
                        { $project: { _id: 1 } },
                    ],
                    as: "rootParent",
                },
            },
            { $match: { "rootParent.0": { $exists: true } } },
            {
                $lookup: {
                    from: collectionName,
                    let: { levelTwoId: "$_id" },
                    pipeline: [
                        { $match: { $expr: { $eq: ["$parentCategory", "$$levelTwoId"] } } },
                        {
                            $set: {
                                ProductCount: {
                                    $ifNull: ["$ProductCount", 0],
                                },
                            },
                        },
                        { $sort: { ProductCount: -1, createdAt: 1, _id: 1 } },
                        { $limit: 4 },
                        {
                            $project: {
                                _id: 1,
                                name: 1,
                                ProductCount: 1,
                                "Image.publicId": 1,
                            },
                        },
                    ],
                    as: "children",
                },
            },
            {
                $set: {
                    ProductCount: {
                        $ifNull: ["$ProductCount", 0],
                    },
                    children: { $ifNull: ["$children", []] },
                },
            },
            { $unset: "rootParent" },
            {
                $facet: {
                    metadata: [{ $count: "totalCategories" }],
                    categories: [
                        { $sort: { ProductCount: -1, createdAt: 1, _id: 1 } },
                        { $skip: skip },
                        { $limit: limit },
                        { $project: { _id: 1, name: 1, ProductCount: 1, children: 1 } },
                    ],
                },
            },
        ]);
        const totalCategories = result?.metadata[0]?.totalCategories ?? 0;
        const categories = result?.categories ?? [];
        res.status(200).json({
            success: true,
            currentPage: page,
            totalPages: Math.ceil(totalCategories / limit),
            totalCategories,
            categories,
        });
    }
    catch (error) {
        next(error);
    }
};
const queryValues = (value) => (Array.isArray(value) ? value : [value]).filter((entry) => typeof entry === "string" && entry.length > 0);
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const numericQuery = (value) => {
    if (typeof value !== "string" || !value.trim())
        return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
};
export const searchResults = async (req, res, next) => {
    try {
        console.time("the database");
        if (Array.isArray(req.query.category) && req.query.category.length > 1) {
            return res.status(400).json({
                success: false,
                message: "Only one category can be selected at a time.",
            });
        }
        const categoryValue = Array.isArray(req.query.category)
            ? req.query.category[0]
            : req.query.category;
        if (typeof categoryValue === "string" &&
            categoryValue &&
            !mongoose.isValidObjectId(categoryValue)) {
            return res.status(400).json({
                success: false,
                message: "The selected category is invalid.",
            });
        }
        const selectedCategoryId = typeof categoryValue === "string" && categoryValue
            ? new mongoose.Types.ObjectId(categoryValue)
            : null;
        let matchingCategoryIds = [];
        let selectedCategories = [];
        let department = null;
        let categoryOptions = [];
        if (selectedCategoryId) {
            const [categoryResult] = await category.aggregate([
                { $match: { _id: selectedCategoryId } },
                {
                    $lookup: {
                        from: category.collection.name,
                        localField: "parentCategory",
                        foreignField: "_id",
                        as: "parentInfo",
                    },
                },
                {
                    $lookup: {
                        from: category.collection.name,
                        localField: "_id",
                        foreignField: "parentCategory",
                        as: "children",
                    },
                },
                {
                    $lookup: {
                        from: category.collection.name,
                        localField: "parentCategory",
                        foreignField: "parentCategory",
                        as: "siblings",
                    },
                },
                {
                    $project: {
                        _id: 1,
                        name: 1,
                        parentCategory: 1,
                        attributes: 1,
                        brands: 1,
                        parent: { $arrayElemAt: ["$parentInfo", 0] },
                        childCount: { $size: "$children" },
                        siblings: {
                            $map: {
                                input: "$siblings",
                                as: "sibling",
                                in: { _id: "$$sibling._id", name: "$$sibling.name" },
                            },
                        },
                    },
                },
            ]);
            const parent = categoryResult?.parent;
            const isLevelThree = !!categoryResult &&
                !!parent?.parentCategory &&
                (categoryResult.childCount ?? 0) === 0;
            if (!isLevelThree) {
                return res.status(400).json({
                    success: false,
                    message: "The selected category is invalid.",
                });
            }
            matchingCategoryIds = [selectedCategoryId];
            department = parent
                ? { id: String(parent._id), name: parent.name ?? "" }
                : null;
            selectedCategories = [
                {
                    _id: categoryResult._id,
                    name: categoryResult.name,
                    parentCategory: categoryResult.parentCategory ?? null,
                    attributes: categoryResult.attributes ?? [],
                    brands: categoryResult.brands ?? [],
                },
            ];
            categoryOptions = (categoryResult.siblings ?? []).map((sibling) => ({
                id: String(sibling._id),
                name: sibling.name ?? "",
            }));
        }
        const rawQuery = typeof req.query.q === "string" && req.query.q.trim()
            ? req.query.q
            : typeof req.query.search === "string"
                ? req.query.search
                : "";
        const search = rawQuery.trim().slice(0, 100);
        const searchRegex = search ? new RegExp(escapeRegex(search), "i") : null;
        const brands = queryValues(req.query.brand).slice(0, 50);
        const selectedColors = queryValues(req.query.color).slice(0, 50);
        const filterableAttributes = new Map((selectedCategories[0]?.attributes ?? [])
            .filter((attribute) => attribute?.filterable && typeof attribute?.key === "string")
            .map((attribute) => [
            attribute.key.toLowerCase(),
            attribute,
        ]));
        const attributeConditions = [];
        const attributeRanges = new Map();
        for (const [paramKey, paramValue] of Object.entries(req.query)) {
            if (!paramKey.startsWith("attr_"))
                continue;
            const rawKey = paramKey.slice(5);
            if (!rawKey)
                continue;
            const rangeMatch = rawKey.match(/^(.*)_(min|max)$/);
            if (rangeMatch) {
                const rangeKey = rangeMatch[1];
                const bound = numericQuery(paramValue);
                if (bound === undefined || bound < 0)
                    continue;
                const range = attributeRanges.get(rangeKey) ?? {};
                if (rangeMatch[2] === "min")
                    range.min = bound;
                else
                    range.max = bound;
                attributeRanges.set(rangeKey, range);
                continue;
            }
            const attrKey = rawKey.toLowerCase();
            const definition = filterableAttributes.get(attrKey);
            if (selectedCategories.length > 0 && !definition)
                continue;
            const rawValues = queryValues(paramValue).slice(0, 20);
            if (!rawValues.length)
                continue;
            const typedValues = definition?.type === "number"
                ? rawValues.map(Number).filter(Number.isFinite)
                : definition?.type === "boolean"
                    ? rawValues
                        .filter((value) => value === "true" || value === "false")
                        .map((value) => value === "true")
                    : rawValues;
            if (!typedValues.length)
                continue;
            attributeConditions.push({
                attributes: {
                    $elemMatch: { key: attrKey, value: { $in: typedValues } },
                },
            });
        }
        for (const [attrKey, range] of attributeRanges) {
            const normalizedKey = attrKey.toLowerCase();
            const definition = filterableAttributes.get(normalizedKey);
            if (definition?.type !== "number")
                continue;
            if (selectedCategories.length > 0 && !definition)
                continue;
            const valueMatch = {};
            if (range.min !== undefined)
                valueMatch.$gte = range.min;
            if (range.max !== undefined)
                valueMatch.$lte = range.max;
            if (Object.keys(valueMatch).length === 0)
                continue;
            attributeConditions.push({
                attributes: {
                    $elemMatch: { key: normalizedKey, value: valueMatch },
                },
            });
        }
        const attributeMatch = attributeConditions.length > 0 ? { $and: attributeConditions } : {};
        const minPrice = numericQuery(req.query.minPrice);
        const maxPrice = numericQuery(req.query.maxPrice);
        const rating = numericQuery(req.query.rating);
        if ([minPrice, maxPrice, rating].some((value) => value !== undefined && value < 0) ||
            (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice)) {
            return res.status(400).json({
                success: false,
                message: "One or more product filters are invalid.",
            });
        }
        const limitValue = numericQuery(req.query.limit);
        const pageValue = numericQuery(req.query.page);
        const limit = Math.min(Math.max(Math.floor(limitValue ?? 20), 1), 50);
        const requestedPage = Math.max(Math.floor(pageValue ?? 1), 1);
        const requestedSkip = (requestedPage - 1) * limit;
        if (!Number.isSafeInteger(requestedSkip)) {
            return res.status(400).json({
                success: false,
                message: "The requested page is too large.",
            });
        }
        const sort = typeof req.query.sort === "string" ? req.query.sort : "featured";
        const sortOrder = sort === "price-low"
            ? { salePrice: 1, _id: 1 }
            : sort === "price-high"
                ? { salePrice: -1, _id: 1 }
                : sort === "rating"
                    ? { rating: -1, _id: 1 }
                    : { createdAt: -1, _id: -1 };
        const categoryInfoStages = () => [
            {
                $lookup: {
                    from: category.collection.name,
                    localField: "categoryID",
                    foreignField: "_id",
                    as: "categoryInfo",
                },
            },
            {
                $addFields: {
                    categoryInfo: {
                        $let: {
                            vars: { category: { $arrayElemAt: ["$categoryInfo", 0] } },
                            in: {
                                $cond: {
                                    if: { $eq: [{ $type: "$$category" }, "object"] },
                                    then: {
                                        _id: "$$category._id",
                                        name: "$$category.name",
                                        parentCategory: "$$category.parentCategory",
                                        attributes: "$$category.attributes",
                                    },
                                    else: "$$category",
                                },
                            },
                        },
                    },
                },
            },
        ];
        const salePriceStage = {
            $addFields: {
                salePrice: {
                    $multiply: [
                        "$price",
                        {
                            $subtract: [
                                1,
                                {
                                    $divide: [{ $ifNull: ["$discount", 0] }, 100],
                                },
                            ],
                        },
                    ],
                },
            },
        };
        const filteredProductStages = (match, includeCategoryInfo = false) => {
            const stages = [
                { $match: match },
            ];
            if (includeCategoryInfo || searchRegex) {
                stages.push(...categoryInfoStages());
            }
            if (searchRegex) {
                stages.push({
                    $match: {
                        $or: [
                            { name: searchRegex },
                            { brand: searchRegex },
                            { description: searchRegex },
                            { "categoryInfo.name": searchRegex },
                        ],
                    },
                });
            }
            return stages;
        };
        const categoryMatch = {};
        if (selectedCategoryId) {
            categoryMatch.categoryID = { $in: matchingCategoryIds };
        }
        const brandMatch = {};
        if (brands.length)
            brandMatch.brand = { $in: brands };
        const colorMatch = {};
        if (selectedColors.length)
            colorMatch.colors = { $in: selectedColors };
        const priceMatch = {};
        if (minPrice !== undefined || maxPrice !== undefined) {
            priceMatch.salePrice = {
                ...(minPrice !== undefined ? { $gte: minPrice } : {}),
                ...(maxPrice !== undefined ? { $lte: maxPrice } : {}),
            };
        }
        const ratingMatch = rating === undefined ? {} : { rating: { $gte: rating } };
        const matchProducts = {
            ...categoryMatch,
            ...brandMatch,
            ...colorMatch,
            ...priceMatch,
            ...ratingMatch,
            ...attributeMatch,
        };
        const activeProductsMatch = {
            status: "active",
            isDeleted: { $ne: true },
        };
        const currentPage = requestedPage;
        const skipped = (requestedPage - 1) * limit;
        const [result] = await ProductSchema.aggregate([
            { $match: activeProductsMatch },
            salePriceStage,
            {
                $facet: {
                    products: [
                        { $match: matchProducts },
                        ...(searchRegex ? categoryInfoStages() : []),
                        ...(searchRegex
                            ? [
                                {
                                    $match: {
                                        $or: [
                                            { name: searchRegex },
                                            { brand: searchRegex },
                                            { description: searchRegex },
                                            { "categoryInfo.name": searchRegex },
                                        ],
                                    },
                                },
                            ]
                            : []),
                        { $sort: sortOrder },
                        { $skip: skipped },
                        { $limit: limit },
                        ...(searchRegex ? [] : categoryInfoStages()),
                        {
                            $project: {
                                _id: 0,
                                id: { $toString: "$_id" },
                                name: 1,
                                description: 1,
                                brand: 1,
                                categoryID: "$categoryInfo.name",
                                categoryId: { $toString: "$categoryInfo._id" },
                                stock: 1,
                                price: 1,
                                discount: 1,
                                rating: 1,
                                reviewCount: 1,
                                color: { $ifNull: [{ $arrayElemAt: ["$colors", 0] }, ""] },
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
                    total: [
                        ...filteredProductStages(matchProducts),
                        { $count: "totalProducts" },
                    ],
                },
            },
        ]);
        const totalProducts = result?.total?.[0]?.totalProducts ?? 0;
        const totalPages = Math.max(1, Math.ceil(totalProducts / limit));
        console.timeEnd("the database");
        return res.status(200).json({
            success: true,
            currentPage,
            totalPages,
            totalProducts,
            skipped,
            limit,
            products: result?.products ?? [],
            department,
            categories: categoryOptions,
            selectedCategory: selectedCategories[0]
                ? {
                    id: selectedCategories[0]._id.toString(),
                    name: selectedCategories[0].name,
                    attributes: (selectedCategories[0].attributes ?? [])
                        .filter((attribute) => attribute.filterable)
                        .map((attribute) => ({
                        key: attribute.key,
                        label: attribute.label,
                        type: attribute.type,
                        unit: attribute.unit,
                        options: attribute.options,
                    })),
                    brands: selectedCategories[0].brands ?? [],
                }
                : null,
            selectedBrands: brands,
            selectedColors,
            colors: [],
            priceRange: null,
            ratingRange: null,
        });
    }
    catch (error) {
        return next(error);
    }
};
