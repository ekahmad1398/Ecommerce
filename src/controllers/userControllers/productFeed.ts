import { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import ProductSchema from "../../models/Product.js";
import User from "../../models/User.js";
import category from "../../models/category.js";

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

type AttributeFilterValue =
  | string
  | number
  | boolean
  | { min?: number; max?: number };

const attributeFiltersQuery = (value: unknown) => {
  if (value === undefined) return {};
  if (typeof value !== "string" || value.length > 2000) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    return null;

  const entries = Object.entries(parsed);
  if (entries.length > 20) return null;
  const filters: Record<string, AttributeFilterValue> = {};
  for (const [rawKey, filterValue] of entries) {
    const key = rawKey.trim().toLowerCase();
    if (!/^[a-z][a-z0-9_]{0,63}$/.test(key)) {
      return null;
    }

    if (
      filterValue &&
      typeof filterValue === "object" &&
      !Array.isArray(filterValue)
    ) {
      const range = filterValue as Record<string, unknown>;
      const rangeKeys = Object.keys(range);
      if (
        rangeKeys.length === 0 ||
        rangeKeys.some(
          (rangeKey) => rangeKey !== "min" && rangeKey !== "max",
        ) ||
        [range.min, range.max].some(
          (bound) =>
            bound !== undefined &&
            (typeof bound !== "number" || !Number.isFinite(bound)),
        ) ||
        (typeof range.min === "number" &&
          typeof range.max === "number" &&
          range.min > range.max)
      ) {
        return null;
      }
      filters[key] = {
        ...(typeof range.min === "number" ? { min: range.min } : {}),
        ...(typeof range.max === "number" ? { max: range.max } : {}),
      };
      continue;
    }

    if (
      (typeof filterValue !== "string" &&
        typeof filterValue !== "number" &&
        typeof filterValue !== "boolean") ||
      (typeof filterValue === "string" && !filterValue.trim()) ||
      (typeof filterValue === "number" && !Number.isFinite(filterValue))
    )
      return null;
    filters[key] = filterValue;
  }
  return filters;
};

// export const FeedProducts = async (
//   req: Request,
//   res: Response,
//   next: NextFunction,
// ) => {
//   try {
//     const categoryValues = queryValues(req.query.category);
//     if (categoryValues.some((id) => !mongoose.isValidObjectId(id))) {
//       return res.status(400).json({
//         success: false,
//         message: "One or more selected categories are invalid.",
//       });
//     }

//     const selectedCategoryIds = categoryValues.map(
//       (id) => new mongoose.Types.ObjectId(id),
//     );
//     const categories = selectedCategoryIds.length
//       ? await category.aggregate([
//           { $match: { _id: { $in: selectedCategoryIds } } },
//           {
//             $graphLookup: {
//               from: category.collection.name,
//               startWith: "$_id",
//               connectFromField: "_id",
//               connectToField: "parentCategory",
//               maxDepth: 1,
//               as: "descendants",
//             },
//           },
//           {
//             $project: {
//               ids: {
//                 $concatArrays: [
//                   ["$_id"],
//                   { $ifNull: ["$descendants._id", []] },
//                 ],
//               },
//             },
//           },
//           { $unwind: "$ids" },
//           { $group: { _id: null, ids: { $addToSet: "$ids" } } },
//         ])
//       : [];
//     const matchingCategoryIds = categories[0]?.ids ?? [];
//     const selectedCategories = selectedCategoryIds.length
//       ? await category
//           .find({ _id: { $in: selectedCategoryIds } })
//           .select("_id name")
//           .lean()
//       : [];

//     const search =
//       typeof req.query.search === "string"
//         ? req.query.search.trim().slice(0, 100)
//         : "";
//     const searchRegex = search ? new RegExp(escapeRegex(search), "i") : null;
//     const brands = queryValues(req.query.brand).slice(0, 50);
//     const selectedColors = queryValues(req.query.color).slice(0, 50);
//     const selectedAttributes = attributeFiltersQuery(req.query.attributes);
//     if (!selectedAttributes) {
//       return res.status(400).json({
//         success: false,
//         message:
//           "The attributes filter must be a JSON object of scalar values.",
//       });
//     }
//     const minPrice = numericQuery(req.query.minPrice);
//     const maxPrice = numericQuery(req.query.maxPrice);
//     const rating = numericQuery(req.query.rating);

//     if (
//       [minPrice, maxPrice, rating].some(
//         (value) => value !== undefined && value < 0,
//       ) ||
//       (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice)
//     ) {
//       return res.status(400).json({
//         success: false,
//         message: "One or more product filters are invalid.",
//       });
//     }

//     const limitValue = numericQuery(req.query.limit);
//     const pageValue = numericQuery(req.query.page);
//     const limit = Math.min(Math.max(Math.floor(limitValue ?? 20), 1), 50);
//     const requestedPage = Math.max(Math.floor(pageValue ?? 1), 1);
//     const requestedSkip = (requestedPage - 1) * limit;
//     if (!Number.isSafeInteger(requestedSkip)) {
//       return res.status(400).json({
//         success: false,
//         message: "The requested page is too large.",
//       });
//     }

//     const sort =
//       typeof req.query.sort === "string" ? req.query.sort : "featured";
//     const sortOrder: Record<string, 1 | -1> =
//       sort === "price-low"
//         ? { salePrice: 1 as const, _id: 1 as const }
//         : sort === "price-high"
//           ? { salePrice: -1 as const, _id: 1 as const }
//           : sort === "rating"
//             ? { rating: -1 as const, _id: 1 as const }
//             : { createdAt: -1 as const, _id: -1 as const };

//     const searchMatch: Record<string, unknown> = searchRegex
//       ? {
//           $or: [
//             { name: searchRegex },
//             { brand: searchRegex },
//             { description: searchRegex },
//             { "categoryInfo.name": searchRegex },
//           ],
//         }
//       : {};

//     const activeProductsMatch = {
//       status: "active",
//       isDeleted: { $ne: true },
//     };

//     const categoryInfoStages = (): mongoose.PipelineStage[] => [
//       {
//         $lookup: {
//           from: category.collection.name,
//           localField: "categoryID",
//           foreignField: "_id",
//           as: "categoryInfo",
//         },
//       },
//       {
//         $addFields: {
//           categoryInfo: {
//             $let: {
//               vars: { category: { $arrayElemAt: ["$categoryInfo", 0] } },
//               in: {
//                 $cond: {
//                   if: { $eq: [{ $type: "$$category" }, "object"] },
//                   then: {
//                     _id: "$$category._id",
//                     name: "$$category.name",
//                     attributes: "$$category.attributes",
//                   },
//                   else: "$$category",
//                 },
//               },
//             },
//           },
//         },
//       },
//     ];

//     const filteredProductStages = (
//       match: Record<string, unknown>,
//       includeCategoryInfo = false,
//     ): mongoose.PipelineStage.FacetPipelineStage[] => {
//       const stages: mongoose.PipelineStage.FacetPipelineStage[] = [
//         {
//           $addFields: {
//             salePrice: {
//               $multiply: [
//                 "$price",
//                 {
//                   $subtract: [
//                     1,
//                     {
//                       $divide: [{ $ifNull: ["$discount", 0] }, 100],
//                     },
//                   ],
//                 },
//               ],
//             },
//           },
//         },
//         { $match: match },
//       ];

//       if (includeCategoryInfo || searchRegex) {
//         stages.push(...categoryInfoStages());
//       }

//       if (searchRegex) {
//         stages.push({ $match: searchMatch });
//       }

//       return stages;
//     };

//     const categoryMatch: Record<string, unknown> = {};
//     if (selectedCategoryIds.length) {
//       categoryMatch.categoryID = { $in: matchingCategoryIds };
//     }

//     const brandMatch: Record<string, unknown> = {};
//     if (brands.length) brandMatch.brand = { $in: brands };

//     const colorMatch: Record<string, unknown> = {};
//     if (selectedColors.length) colorMatch.colors = { $in: selectedColors };

//     const priceMatch: Record<string, unknown> = {};
//     if (minPrice !== undefined || maxPrice !== undefined) {
//       priceMatch.salePrice = {
//         ...(minPrice !== undefined ? { $gte: minPrice } : {}),
//         ...(maxPrice !== undefined ? { $lte: maxPrice } : {}),
//       };
//     }

//     const ratingMatch: Record<string, unknown> =
//       rating === undefined ? {} : { rating: { $gte: rating } };
//     const matchWithoutCategory = {
//       ...brandMatch,
//       ...colorMatch,
//       ...priceMatch,
//       ...ratingMatch,
//     };
//     const matchWithoutBrand = {
//       ...categoryMatch,
//       ...colorMatch,
//       ...priceMatch,
//       ...ratingMatch,
//     };
//     const matchWithoutPrice = {
//       ...categoryMatch,
//       ...brandMatch,
//       ...colorMatch,
//       ...ratingMatch,
//     };
//     const matchWithoutRating = {
//       ...categoryMatch,
//       ...brandMatch,
//       ...colorMatch,
//       ...priceMatch,
//     };
//     const matchWithoutColor = {
//       ...categoryMatch,
//       ...brandMatch,
//       ...priceMatch,
//       ...ratingMatch,
//     };
//     const matchProducts = {
//       ...categoryMatch,
//       ...brandMatch,
//       ...colorMatch,
//       ...priceMatch,
//       ...ratingMatch,
//     };

//     const [matchingCount] = await ProductSchema.aggregate([
//       { $match: activeProductsMatch },
//       ...filteredProductStages(matchProducts),
//       { $count: "totalProducts" },
//     ]);
//     const totalProducts = matchingCount?.totalProducts ?? 0;
//     const totalPages = Math.max(1, Math.ceil(totalProducts / limit));
//     const currentPage = Math.min(requestedPage, totalPages);
//     const skipped = (currentPage - 1) * limit;

//     const [result] = await ProductSchema.aggregate([
//       { $match: activeProductsMatch },
//       {
//         $facet: {
//           products: [
//             ...filteredProductStages(matchProducts, true),
//             { $sort: sortOrder },
//             { $skip: skipped },
//             { $limit: limit },
//             {
//               $project: {
//                 _id: 0,
//                 id: { $toString: "$_id" },
//                 name: 1,
//                 description: 1,
//                 brand: 1,
//                 categoryID: "$categoryInfo.name",
//                 categoryId: { $toString: "$categoryInfo._id" },
//                 stock: 1,
//                 price: 1,
//                 discount: 1,
//                 rating: 1,
//                 reviewCount: 1,
//                 attributes: 1,
//                 color: { $ifNull: [{ $arrayElemAt: ["$colors", 0] }, ""] },
//                 images: {
//                   $map: {
//                     input: { $ifNull: ["$images", []] },
//                     as: "image",
//                     in: "$$image.publicId",
//                   },
//                 },
//               },
//             },
//           ],
//           categories: [
//             ...filteredProductStages(matchWithoutCategory, true),
//             {
//               $group: {
//                 _id: "$categoryInfo._id",
//                 name: { $first: "$categoryInfo.name" },
//               },
//             },
//             { $sort: { name: 1 } },
//             { $project: { _id: 0, id: { $toString: "$_id" }, name: 1 } },
//           ],
//           brands: [
//             ...filteredProductStages(matchWithoutBrand),
//             { $group: { _id: "$brand" } },
//             { $sort: { _id: 1 } },
//             { $project: { _id: 0, name: "$_id" } },
//           ],
//           colors: [
//             ...filteredProductStages(matchWithoutColor),
//             { $unwind: "$colors" },
//             { $match: { colors: { $type: "string", $ne: "" } } },
//             { $group: { _id: "$colors" } },
//             { $sort: { _id: 1 } },
//             { $project: { _id: 0, name: "$_id" } },
//           ],
//           priceRange: [
//             ...filteredProductStages(matchWithoutPrice),
//             {
//               $group: {
//                 _id: null,
//                 min: { $min: "$salePrice" },
//                 max: { $max: "$salePrice" },
//               },
//             },
//             { $project: { _id: 0 } },
//           ],
//           ratingRange: [
//             ...filteredProductStages(matchWithoutRating),
//             {
//               $group: {
//                 _id: null,
//                 min: { $min: "$rating" },
//                 max: { $max: "$rating" },
//               },
//             },
//             { $project: { _id: 0 } },
//           ],
//         },
//       },
//     ]);
//     return res.status(200).json({
//       success: true,
//       currentPage,
//       totalPages,
//       totalProducts,
//       skipped,
//       limit,
//       products: result?.products ?? [],
//       categories: result?.categories ?? [],
//       selectedCategories: selectedCategories.map((selectedCategory) => ({
//         id: selectedCategory._id.toString(),
//         name: selectedCategory.name,
//       })),
//       selectedBrands: brands,
//       selectedColors,
//       brands: (result?.brands ?? []).map(
//         (brandItem: { name: string }) => brandItem.name,
//       ),
//       colors: (result?.colors ?? []).map(
//         (colorItem: { name: string }) => colorItem.name,
//       ),
//       priceRange: result?.priceRange[0] ?? null,
//       ratingRange: result?.ratingRange[0] ?? null,
//     });
//   } catch (error) {
//     return next(error);
//   }
// };

export const specificProduct = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const product = await ProductSchema.findOne({
      _id: id,
      status: "active",
      isDeleted: { $ne: true },
    })
      .populate("categoryID", "name attributes")
      .populate(
        "vendorId",
        "storeDescription companyName storeSlug mobilenumber Companyimage",
      )
      .lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message:
          "product not found or is no longer available on the marketplace",
      });
    }

    const categoryData = product.categoryID as unknown as {
      name: string;
      attributes?: unknown[];
    };
    const vendor = product.vendorId as unknown as {
      companyName: string;
      storeSlug: string;
      mobilenumber: string;
      Companyimage: string;
      storeDescription: string;
    };

    return res.status(200).json({
      success: true,
      id: product._id,
      name: product.name,
      sku: product.sku,
      price: product.price,
      stock: product.stock,
      description: product.description,
      attributes: product.attributes,
      images: product.images,
      category: {
        allowedFilters: categoryData.attributes ?? [],
        name: categoryData.name,
      },
      store: {
        name: vendor.companyName,
        slug: vendor.storeSlug,
        PhoneNumber: vendor.mobilenumber,
        Companyimage: vendor.Companyimage,
        storeDescription: vendor.storeDescription,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const userProfile = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userID = (req as any).user.id;
    const userData = await User.findById(userID);

    if (!userData) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    return res.status(200).json({
      success: true,
      userData,
    });
  } catch (error) {
    return next(error);
  }
};
