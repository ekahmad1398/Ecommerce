import { NextFunction, Request, Response } from "express";
import Product from "../../models/Product.js";
import category from "../../models/category.js";

export const getHomeCategories = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
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
    const productCollectionName = Product.collection.name;
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
              $lookup: {
                from: productCollectionName,
                let: { levelThreeId: "$_id" },
                pipeline: [
                  {
                    $match: {
                      status: "active",
                      isDeleted: { $ne: true },
                      $expr: {
                        $eq: ["$categoryID", "$$levelThreeId"],
                      },
                    },
                  },
                  { $count: "count" },
                ],
                as: "activeProductCount",
              },
            },
            {
              $set: {
                ProductCount: {
                  $ifNull: [
                    { $arrayElemAt: ["$activeProductCount.count", 0] },
                    0,
                  ],
                },
              },
            },
            { $sort: { ProductCount: -1, createdAt: 1, _id: 1 } },
            {
              $group: {
                _id: null,
                ProductCount: { $sum: "$ProductCount" },
                children: {
                  $push: {
                    _id: "$_id",
                    name: "$name",
                    ProductCount: "$ProductCount",
                    Image: { publicId: "$Image.publicId" },
                  },
                },
              },
            },
            {
              $project: {
                _id: 0,
                ProductCount: 1,
                children: { $slice: ["$children", 4] },
              },
            },
          ],
          as: "subcategoryStats",
        },
      },
      {
        $set: {
          ProductCount: {
            $ifNull: [
              { $arrayElemAt: ["$subcategoryStats.ProductCount", 0] },
              0,
            ],
          },
          children: {
            $ifNull: [
              { $arrayElemAt: ["$subcategoryStats.children", 0] },
              [],
            ],
          },
        },
      },
      { $unset: ["rootParent", "subcategoryStats"] },
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

export const GetCategories = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const parentFilter = { parentCategory: null };
    const totalCategories = await category.countDocuments(parentFilter);
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);
    const totalPages = Math.ceil(totalCategories / limit);
    const page = Math.min(
      Math.max(Number(req.query.page) || 1, 1),
      Math.max(totalPages, 1),
    );
    const skip = (page - 1) * limit;

    const parentCategories = await category
      .find(parentFilter)
      .select("name Image _id ProductCount")
      .sort({ ProductCount: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const children = await category
      .find({
        parentCategory: { $in: parentCategories.map(({ _id }) => _id) },
      })
      .select("name Image parentCategory ProductCount")
      .sort({ createdAt: -1 })
      .lean();

    const childrenByParent = new Map<string, typeof children>();
    for (const child of children) {
      const parentId = String(child.parentCategory);
      const siblings = childrenByParent.get(parentId) ?? [];
      siblings.push(child);
      childrenByParent.set(parentId, siblings);
    }

    const formatedData = parentCategories.map(({ Image, ...parent }) => ({
      ...parent,
      image: Image,
      children: (childrenByParent.get(String(parent._id)) ?? []).map(
        ({ Image, ...child }) => ({ ...child, image: Image }),
      ),
    }));

    res.status(200).json({
      success: true,
      currentPage: page,
      totalPages,
      totalCategories,
      categories: formatedData,
    });
  } catch (error) {
    next(error);
  }
};
