import category from "../../models/category.js";
import Product from "../../models/Product.js";
import { deleteFromCloudinary, uploadToCloudinary, } from "../../middleware/upload.js";
export const createCategory = async (req, res, next) => {
    try {
        const { name, parentCategory, image } = req.body;
        const existingCategory = await category.findOne({
            name,
            parentCategory: parentCategory || null,
        });
        if (existingCategory) {
            return res
                .status(400)
                .json({ success: false, message: "a category already exists" });
        }
        const isavailabe = await category.findById(parentCategory).lean();
        if (!isavailabe) {
            return res
                .status(404)
                .json({ success: false, message: "parent category not found." });
        }
        const uploading = await uploadToCloudinary(image);
        if (!uploading) {
            return res.status(500).json({
                success: false,
                message: "Category image upload failed.",
            });
        }
        const newCategory = await category.create({
            name,
            parentCategory: parentCategory || null,
            Image: {
                cloudinaryId: uploading.secure_url,
                publicId: uploading.public_id,
            },
        });
        res.status(201).json({
            success: true,
            category: newCategory,
            message: "marketplace category created successfully",
        });
    }
    catch (error) {
        next(error);
    }
};
export const getAllCategories = async (req, res, next) => {
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
    }
    catch (error) {
        next(error);
    }
};
export const deleteCategory = async (req, res, next) => {
    try {
        const { id } = req.params;
        const productCategory = await Product.findOne({ category: id }).lean();
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
                message: "cannot delete the product. A subCategory is already available.",
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
        await category.findByIdAndDelete(Deletingcategory);
        res.status(200).json({
            success: true,
            message: "the category is deleted successfully.",
        });
    }
    catch (error) {
        next(error);
    }
};
