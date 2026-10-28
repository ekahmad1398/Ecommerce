import { NextFunction, Request, Response } from "express";
import category from "../../models/category.js";

import {
  deleteFromCloudinary,
  uploadToCloudinary,
} from "../../middleware/upload.js";
import { updateCategoryBodySchema } from "../../utils/zodValidators.js";
import Product from "../../models/Product.js";
import { optimizeCategory } from "../../utils/optimizer.js";

export const createCategory = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { name, parentCategory } = req.body;
    const imageFile = req.file;

    if (!name || typeof name !== "string") {
      return res.status(400).json({
        success: false,
        message: "Category name is required.",
      });
    }

    const existingCategory = await category.findOne({
      name,
      parentCategory: parentCategory || null,
    });
    if (existingCategory) {
      return res
        .status(400)
        .json({ success: false, message: "a category already exists" });
    }

    if (parentCategory) {
      const isavailabe = await category.findById(parentCategory).lean();

      if (!isavailabe) {
        return res
          .status(404)
          .json({ success: false, message: "parent category not found." });
      }
    }
    let data: {
      name: string;
      parentCategory: string;
      Image?: { cloudinaryId: string; publicId: string };
    } = { name: name, parentCategory: parentCategory };
    if (imageFile) {
      const uploading = await uploadToCloudinary(imageFile.buffer);
      if (!uploading) {
        return res.status(500).json({
          success: false,
          message: "Category image upload failed.",
        });
      }
      data.Image = {
        cloudinaryId: optimizeCategory(uploading.public_id),
        publicId: uploading.secure_url,
      };
    }

    const newCategory = await category.create(data);
    res.status(201).json({
      success: true,
      category: newCategory,
      message: "marketplace category created successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const updateCategory = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  let replacementPublicId: string | undefined;
  try {
    const parsedBody = updateCategoryBodySchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid category data.",
        errors: parsedBody.error.issues,
      });
    }
    const validatedData = parsedBody.data;
    const CategoryID = req.params.id;
    if (!CategoryID) {
      return res.status(400).json({
        success: false,
        message: "A category ID is required.",
      });
    }
    const categoryData = await category.findById(CategoryID);
    if (!categoryData) {
      return res
        .status(404)
        .json({ success: false, message: "categoryData not found." });
    }

    const newImage = req.file;

    const updates: {
      name?: string;
      parentCategory?: string | null;
      Image?: { cloudinaryId: string; publicId: string };
    } = {};

    if (validatedData.name !== undefined) {
      updates.name = validatedData.name;
    }

    const requestedParent = validatedData.parentCategory;
    if (requestedParent !== undefined) {
      const parentId = requestedParent.trim();
      if (parentId && parentId === CategoryID) {
        return res.status(400).json({
          success: false,
          message: "A category cannot be its own parent.",
        });
      }
      if (parentId && !(await category.exists({ _id: parentId }))) {
        return res.status(404).json({
          success: false,
          message: "Parent category not found.",
        });
      }
      updates.parentCategory = parentId || null;
    }

    if (newImage) {
      const uploading = await uploadToCloudinary(newImage.buffer);
      if (!uploading) {
        return res.status(500).json({
          success: false,
          message: "Category image upload failed.",
        });
      }
      replacementPublicId = uploading.public_id;
      updates.Image = {
        cloudinaryId: uploading.public_id,
        publicId: optimizeCategory(uploading.secure_url),
      };
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Provide at least one category field to update.",
      });
    }

    const updatedCategory = await category.findByIdAndUpdate(
      CategoryID,
      { $set: updates },
      { runValidators: true, returnDocument: "after" },
    );

    if (!updatedCategory) {
      if (replacementPublicId) await deleteFromCloudinary(replacementPublicId);
      return res.status(404).json({
        success: false,
        message: "categoryData not found.",
      });
    }

    if (replacementPublicId && categoryData.Image?.publicId) {
      await deleteFromCloudinary(categoryData.Image.publicId);
      replacementPublicId = undefined;
    }

    res.status(200).json({
      success: true,
      updatedCategory,
    });
  } catch (error) {
    if (replacementPublicId) await deleteFromCloudinary(replacementPublicId);
    next(error);
  }
};

export const getAllCategories = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const totalCategories = await category.countDocuments();
  const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);
  const totalPages = Math.ceil(totalCategories / limit);
  const page = Math.min(
    Math.max(Number(req.query.page) || 1, 1),
    Math.max(totalPages, 1),
  );
  const skip = (page - 1) * limit;
  try {
    const categories = await category
      .find()
      .populate("parentCategory", "name")
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      currentPage: page,
      limit: limit,
      skip: skip,
      totalPages,
      totalCategories,
      categories,
    });
  } catch (error) {
    next(error);
  }
};

export const specificCategoryName = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const searchTerm = req.query.name;
    const filter =
      typeof searchTerm === "string" && searchTerm.trim()
        ? {
            name: {
              $regex: searchTerm.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
              $options: "i",
            },
          }
        : {};

    const categories = await category
      .find(filter)
      .populate("parentCategory", "name")
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      categories,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteCategory = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const productCategory = await Product.findOne({ categoryID: id }).lean();
    if (productCategory) {
      return res.status(400).json({
        success: false,
        message: "cannot delete the product. A category is already available.",
      });
    }
    const hasSubCategory = await category.findOne({ parentCategory: id });
    if (hasSubCategory) {
      return res.status(400).json({
        success: false,
        message:
          "cannot delete the product. A subCategory is already available.",
      });
    }
    const Deletingcategory = await category.findById(id);
    if (!Deletingcategory) {
      return res.status(404).json({
        success: false,
        message: "Category not found.",
      });
    }
    await deleteFromCloudinary(Deletingcategory.Image?.publicId);
    await category.findByIdAndDelete(id);
    res.status(200).json({
      success: true,
      message: "the category is deleted successfully.",
    });
  } catch (error) {
    next(error);
  }
};
