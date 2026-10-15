import { NextFunction, Request, Response } from "express";
import category from "../../models/category.js";
import Product from "../../models/Product.js";

export const createCategory = async (req:Request, res:Response, next:NextFunction) => {
  try {
    const { name, parentCategory} = req.body;

    const existingCategory = await category.findOne({
      name,
      parentCategory: parentCategory || null,
    });
    if (existingCategory) {
      return res.status(400).json({ success: false });
    }
    const newCategory = await category.create({
      name,
      parentCategory: parentCategory || null
    });
    res.status(201).json({
      success: true,
      category: newCategory,
      message: "marketplace category created successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const getAllCategories = async (req:Request, res:Response, next:NextFunction) => {
  try {
    const categories = await category
      .find()
      .populate("parentCategory", "name")
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: categories.length,
      categories,
    });
    
  } catch (error) {
    next(error);
  }
};

export const deleteCategory = async (req:Request, res:Response, next:NextFunction) => {
  try {
    const { id } = req.params;
    const productCategory = await Product.findOne({ category: id });
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
    const deleteCategory = await category.findByIdAndDelete(id);

    if (!deleteCategory) {
      return res.status(404).json({
        success: false,
        message: "Category not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: "the category is deleted successfully.",
    });
  } catch (error) {
    next(error);
  }
};
