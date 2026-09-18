import category from "../../models/category";

export const createCategory = async (req, res, next) => {
  try {
    const { name, parentCategory, attributes } = req.body;

    const existingCategory = await category.findOne({
      name,
      parentCategory: parentCategory || null,
    });
    if (existingCategory) {
      return res.status(400).json({ success: false });
    }
    const newCategory = await category.create({
      name,
      parentCategory: parentCategory || null,
      attributes: attributes || [],
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

    res.status(201).json({
      success: true,
      category: newCategory,
      message: "marketplace category created successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const productCategory = await product.findOne({ category: id });
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
