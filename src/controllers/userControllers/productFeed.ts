import { NextFunction, Request, Response } from "express";
import ProductSchema from "../../models/Product.js";
import User from "../../models/User.js";

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
