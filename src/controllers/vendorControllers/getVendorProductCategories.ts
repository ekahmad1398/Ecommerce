import type { Request, Response, NextFunction } from "express";
import category from "../../models/category.js";

export const getVendorProductCategories = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const levelOneCategories = await category
      .find({ parentCategory: null })
      .select("_id name")
      .sort({ name: 1 })
      .lean();
    const levelOneIds = levelOneCategories.map(({ _id }) => _id);

    if (levelOneIds.length === 0) {
      return res.status(200).json({ success: true, categories: [] });
    }

    const levelTwoCategories = await category
      .find({ parentCategory: { $in: levelOneIds } })
      .select("_id name parentCategory")
      .sort({ name: 1 })
      .lean();
    const levelTwoIds = levelTwoCategories.map(({ _id }) => _id);

    const levelThreeCategories =
      levelTwoIds.length > 0
        ? await category
            .find({ parentCategory: { $in: levelTwoIds } })
            .select("_id name parentCategory brands")
            .sort({ name: 1 })
            .lean()
        : [];

    const childrenByParent = new Map<
      string,
      Array<{ _id: string; name: string; brands: string[] }>
    >();

    for (const child of levelThreeCategories) {
      const parentId = String(child.parentCategory);
      const children = childrenByParent.get(parentId) ?? [];
      children.push({
        _id: String(child._id),
        name: child.name,
        brands: child.brands ?? [],
      });
      childrenByParent.set(parentId, children);
    }

    const levelTwoByParent = new Map<
      string,
      Array<{
        _id: string;
        name: string;
        children: Array<{ _id: string; name: string; brands: string[] }>;
      }>
    >();

    for (const item of levelTwoCategories) {
      const parentId = String(item.parentCategory);
      const children = levelTwoByParent.get(parentId) ?? [];
      children.push({
        _id: String(item._id),
        name: item.name,
        children: childrenByParent.get(String(item._id)) ?? [],
      });
      levelTwoByParent.set(parentId, children);
    }

    const categories = levelOneCategories.map((item) => ({
      _id: String(item._id),
      name: item.name,
      children: levelTwoByParent.get(String(item._id)) ?? [],
    }));

    return res.status(200).json({ success: true, categories });
  } catch (error) {
    return next(error);
  }
};
