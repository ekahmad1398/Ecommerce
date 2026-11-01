import { NextFunction, Request, Response } from "express";
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
    const [result] = await category.aggregate([
      { $match: { parentCategory: null } },
      {
        $facet: {
          metadata: [{ $count: "totalCategories" }],
          categories: [
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
              $lookup: {
                from: collectionName,
                let: { rootId: "$_id" },
                pipeline:[
                  {$match:{ $expr:{$eq: ["$parentCategory", "$$rootId"]}}},
                  {$sort:{createdAt:1}},
                  {$limit:4},
                  { $project: { _id: 1, name: 1, "Image.publicId": 1 } },
                ],
                as: "children",
              },
            },
            { $project: { _id: 1, name: 1, children: 1 } },
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
      .select("name Image _id")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const children = await category
      .find({
        parentCategory: { $in: parentCategories.map(({ _id }) => _id) },
      })
      .select("name Image parentCategory")
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
