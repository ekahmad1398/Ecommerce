import { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import category from "../../models/category.js";
import ProductSchema from "../../models/Product.js";

export const getHomeCategories = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const requestedLimit = Number(req.query.limit);
    const requestedPage = Number(req.query.page);
    const limit =
      Number.isSafeInteger(requestedLimit) && requestedLimit > 0
        ? Math.min(requestedLimit, 50)
        : 10;
    const page =
      Number.isSafeInteger(requestedPage) && requestedPage > 0
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
  } catch (error) {
    next(error);
  }
};

const queryValues = (value: unknown) =>
  (Array.isArray(value) ? value : [value]).filter(
    (entry): entry is string => typeof entry === "string" && entry.length > 0,
  );

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const numericQuery = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const searchResults = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const categoryValues = queryValues(req.query.category);
    if (categoryValues.some((id) => !mongoose.isValidObjectId(id))) {
      return res.status(400).json({
        success: false,
        message: "One or more selected categories are invalid.",
      });
    }

    const selectedCategoryIds = categoryValues.map(
      (id) => new mongoose.Types.ObjectId(id),
    );
    const [categories, selectedCategories] = await Promise.all([
      selectedCategoryIds.length
        ? category.aggregate([
            { $match: { _id: { $in: selectedCategoryIds } } },
            {
              $graphLookup: {
                from: category.collection.name,
                startWith: "$_id",
                connectFromField: "_id",
                connectToField: "parentCategory",
                maxDepth: 2,
                as: "descendants",
              },
            },
            {
              $project: {
                ids: {
                  $concatArrays: [
                    ["$_id"],
                    { $ifNull: ["$descendants._id", []] },
                  ],
                },
              },
            },
            { $unwind: "$ids" },
            { $group: { _id: null, ids: { $addToSet: "$ids" } } },
          ])
        : Promise.resolve([]),
      selectedCategoryIds.length
        ? category
            .find({ _id: { $in: selectedCategoryIds } })
            .select("_id name parentCategory attributes brands")
            .lean()
        : Promise.resolve([]),
    ]);
    const matchingCategoryIds = categories[0]?.ids ?? [];

    const siblingCategoryIds = new Set<string>();
    if (selectedCategories.length) {
      const parentKeys = [
        ...new Set(
          selectedCategories.map((selected) =>
            selected.parentCategory
              ? selected.parentCategory.toString()
              : null,
          ),
        ),
      ];
      const parentObjectIds = parentKeys
        .filter((key): key is string => key !== null)
        .map((id) => new mongoose.Types.ObjectId(id));
      const siblingDocs = await category
        .find({
          $or: [
            ...(parentObjectIds.length
              ? [{ parentCategory: { $in: parentObjectIds } }]
              : []),
            ...(parentKeys.includes(null) ? [{ parentCategory: null }] : []),
          ],
        })
        .select("_id")
        .lean();
      for (const doc of siblingDocs) {
        siblingCategoryIds.add(doc._id.toString());
      }
    }

    const rawQuery =
      typeof req.query.q === "string" && req.query.q.trim()
        ? req.query.q
        : typeof req.query.search === "string"
          ? req.query.search
          : "";
    const search = rawQuery.trim().slice(0, 100);
    const searchRegex = search ? new RegExp(escapeRegex(search), "i") : null;
    const brands = queryValues(req.query.brand).slice(0, 50);
    const selectedColors = queryValues(req.query.color).slice(0, 50);
    const minPrice = numericQuery(req.query.minPrice);
    const maxPrice = numericQuery(req.query.maxPrice);
    const rating = numericQuery(req.query.rating);

    if (
      [minPrice, maxPrice, rating].some(
        (value) => value !== undefined && value < 0,
      ) ||
      (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice)
    ) {
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

    const sort =
      typeof req.query.sort === "string" ? req.query.sort : "featured";
    const sortOrder: Record<string, 1 | -1> =
      sort === "price-low"
        ? { salePrice: 1 as const, _id: 1 as const }
        : sort === "price-high"
          ? { salePrice: -1 as const, _id: 1 as const }
          : sort === "rating"
            ? { rating: -1 as const, _id: 1 as const }
            : { createdAt: -1 as const, _id: -1 as const };

    const categoryInfoStages = (): mongoose.PipelineStage.FacetPipelineStage[] => [
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

    const salePriceStage: mongoose.PipelineStage.AddFields = {
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

    const filteredProductStages = (
      match: Record<string, unknown>,
      includeCategoryInfo = false,
    ): mongoose.PipelineStage.FacetPipelineStage[] => {
      const stages: mongoose.PipelineStage.FacetPipelineStage[] = [
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

    const categoryMatch: Record<string, unknown> = {};
    if (selectedCategoryIds.length) {
      categoryMatch.categoryID = { $in: matchingCategoryIds };
    }

    const brandMatch: Record<string, unknown> = {};
    if (brands.length) brandMatch.brand = { $in: brands };

    const colorMatch: Record<string, unknown> = {};
    if (selectedColors.length) colorMatch.colors = { $in: selectedColors };

    const priceMatch: Record<string, unknown> = {};
    if (minPrice !== undefined || maxPrice !== undefined) {
      priceMatch.salePrice = {
        ...(minPrice !== undefined ? { $gte: minPrice } : {}),
        ...(maxPrice !== undefined ? { $lte: maxPrice } : {}),
      };
    }

    const ratingMatch: Record<string, unknown> =
      rating === undefined ? {} : { rating: { $gte: rating } };
    const matchWithoutCategory = {
      ...brandMatch,
      ...colorMatch,
      ...priceMatch,
      ...ratingMatch,
    };
    const matchWithoutBrand = {
      ...categoryMatch,
      ...colorMatch,
      ...priceMatch,
      ...ratingMatch,
    };
    const matchWithoutPrice = {
      ...categoryMatch,
      ...brandMatch,
      ...colorMatch,
      ...ratingMatch,
    };
    const matchWithoutRating = {
      ...categoryMatch,
      ...brandMatch,
      ...colorMatch,
      ...priceMatch,
    };
    const matchWithoutColor = {
      ...categoryMatch,
      ...brandMatch,
      ...priceMatch,
      ...ratingMatch,
    };
    const matchProducts = {
      ...categoryMatch,
      ...brandMatch,
      ...colorMatch,
      ...priceMatch,
      ...ratingMatch,
    };

    const activeProductsMatch = {
      status: "active",
      isDeleted: { $ne: true },
    };

    const currentPage = requestedPage;
    const skipped = (requestedPage - 1) * limit;

    const categoriesFacet: mongoose.PipelineStage.FacetPipelineStage[] =
      siblingCategoryIds.size > 0
        ? [
            ...filteredProductStages(matchWithoutCategory, true),
            { $match: { "categoryInfo._id": { $ne: null } } },
            {
              $group: {
                _id: "$categoryInfo._id",
                name: { $first: "$categoryInfo.name" },
              },
            },
            { $sort: { name: 1 } },
            { $project: { _id: 0, id: { $toString: "$_id" }, name: 1 } },
          ]
        : [
            ...filteredProductStages(matchWithoutCategory, true),
            { $match: { "categoryInfo._id": { $ne: null } } },
            {
              $group: {
                _id: "$categoryInfo._id",
                categoryInfo: { $first: "$categoryInfo" },
              },
            },
            {
              $graphLookup: {
                from: category.collection.name,
                startWith: "$categoryInfo.parentCategory",
                connectFromField: "parentCategory",
                connectToField: "_id",
                as: "ancestors",
                maxDepth: 3,
              },
            },
            {
              $addFields: {
                department: {
                  $ifNull: [
                    {
                      $arrayElemAt: [
                        {
                          $filter: {
                            input: "$ancestors",
                            as: "ancestor",
                            cond: { $eq: ["$$ancestor.parentCategory", null] },
                          },
                        },
                        0,
                      ],
                    },
                    "$categoryInfo",
                  ],
                },
              },
            },
            {
              $group: {
                _id: "$department._id",
                name: { $first: "$department.name" },
              },
            },
            { $sort: { name: 1 } },
            { $project: { _id: 0, id: { $toString: "$_id" }, name: 1 } },
          ];

    const [result] = await ProductSchema.aggregate([
      { $match: activeProductsMatch },
      salePriceStage,
      {
        $facet: {
          products: [
            ...filteredProductStages(matchProducts, true),
            { $sort: sortOrder },
            { $skip: skipped },
            { $limit: limit },
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
                attributes: 1,
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
          categories: categoriesFacet,
          brands: [
            ...filteredProductStages(matchWithoutBrand),
            { $group: { _id: "$brand" } },
            { $sort: { _id: 1 } },
            { $project: { _id: 0, name: "$_id" } },
          ],
          colors: [
            ...filteredProductStages(matchWithoutColor),
            { $unwind: "$colors" },
            { $match: { colors: { $type: "string", $ne: "" } } },
            { $group: { _id: "$colors" } },
            { $sort: { _id: 1 } },
            { $project: { _id: 0, name: "$_id" } },
          ],
          priceRange: [
            ...filteredProductStages(matchWithoutPrice),
            {
              $group: {
                _id: null,
                min: { $min: "$salePrice" },
                max: { $max: "$salePrice" },
              },
            },
            { $project: { _id: 0 } },
          ],
          ratingRange: [
            ...filteredProductStages(matchWithoutRating),
            {
              $group: {
                _id: null,
                min: { $min: "$rating" },
                max: { $max: "$rating" },
              },
            },
            { $project: { _id: 0 } },
          ],
        },
      },
    ]);

    const totalProducts = result?.total?.[0]?.totalProducts ?? 0;
    const totalPages = Math.max(1, Math.ceil(totalProducts / limit));

    return res.status(200).json({
      success: true,
      currentPage,
      totalPages,
      totalProducts,
      skipped,
      limit,
      products: result?.products ?? [],
      categories:
        siblingCategoryIds.size > 0
          ? (result?.categories ?? []).filter(
              (item: { id: string }) => siblingCategoryIds.has(item.id),
            )
          : (result?.categories ?? []),
      selectedCategories: selectedCategories.map((selectedCategory) => ({
        id: selectedCategory._id.toString(),
        name: selectedCategory.name,
        attributes: (selectedCategory.attributes ?? [])
          .filter((attribute) => attribute.filterable)
          .map((attribute) => ({
            key: attribute.key,
            label: attribute.label,
            type: attribute.type,
            unit: attribute.unit,
            options: attribute.options,
          })),
        brands: selectedCategory.brands ?? [],
      })),
      selectedBrands: brands,
      selectedColors,
      brands: (result?.brands ?? []).map(
        (brandItem: { name: string }) => brandItem.name,
      ),
      colors: (result?.colors ?? []).map(
        (colorItem: { name: string }) => colorItem.name,
      ),
      priceRange: result?.priceRange[0] ?? null,
      ratingRange: result?.ratingRange[0] ?? null,
    });
  } catch (error) {
    return next(error);
  }
};
