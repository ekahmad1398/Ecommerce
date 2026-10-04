import Product, { generateSKU } from "../../models/Product.js";
import categorySchema from "../../models/category.js";
import type { Request, Response, NextFunction } from "express";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
} from "../../middleware/upload.js";
import { optimizefunction } from "../../utils/optimizer.js";
import {
  productBodySchema,
  updateproductBodySchema,
} from "../../utils/zodValidators.js";

export const CreateVendorProduct = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const vendorID = (req as any).user.vendorID;
    const validatedData = productBodySchema.parse(req.body);

    const duplicateProduct = await Product.findOne({
      name: validatedData.name,
      brand: validatedData.brand,
    });
    if (duplicateProduct) {
      return res.status(400).json({
        success: false,
        message:
          "This product has already been create, you cannot upload duplicates.",
      });
    }

    const incomingImages = Array.isArray(req.files) ? req.files : [];

    const targetCategory = await categorySchema.findById(
      validatedData.categoryID,
    );
    if (!targetCategory) {
      res.status(400).json({
        success: false,
        message: "Selected MarketPlace category does not exist.",
      });
    }

    let imagesData = [];

    if (incomingImages.length > 0) {
      const result = await Promise.all(
        incomingImages.map((file) => uploadToCloudinary(file.buffer)),
      );

      for (const data of result) {
        const optimizedImage = optimizefunction(data.secure_url);
        imagesData.push({
          cloudinaryId: optimizedImage,
          publicId: data.public_id,
        });
      }
    } else {
      return res
        .status(400)
        .json({ success: false, message: "at least one image is required." });
    }

    const createdSKU = generateSKU({
      name: validatedData.name,
      brand: validatedData.brand,
      color: validatedData.color,
    });

    let attribueteArray = [];
    if (validatedData.attributes) {
      try {
        for (const attribute of validatedData.attributes) {
          attribueteArray.push({
            key: attribute.key,
            value: attribute.value,
          });
        }
      } catch (error) {
        res.status(400).json({
          success: false,
          message: "The attribute array must be a valid JSON array string.",
        });
      }
    }

    const addedProduct = await Product.create({
      name: validatedData.name,
      description: validatedData.description,
      brand: validatedData.brand,
      categoryID: validatedData.categoryID,
      stock: validatedData.stock,
      price: validatedData.price,
      discount: validatedData.discount,
      color: validatedData.color,
      sku: createdSKU,
      vendorId: vendorID,
      images: imagesData,
      attributes: attribueteArray,
    });

    res.status(201).json({
      success: true,
      newProduct: addedProduct,
    });
  } catch (error) {
    next(error);
  }
};

export const UpdateVendorProduct = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const vendorId = (req as any).user.vendorID;
    const validatedData = updateproductBodySchema.parse(req.body);
    const productID = req.params.id;
    if (!vendorId || !productID) {
      res.status(403).json({
        success: false,
        message: "access unauthorized. verified vendor required",
      });
    }
    const newImages = Array.isArray(req.files) ? req.files : [];

    const product = await Product.findOne({ _id: productID, vendorId });

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "product not found." });
    }

    const clientImages = validatedData.images ?? [];
    const imagesToDelete = product.images.filter(
      (mongoImages: {
        publicId?: string;
        cloudinaryId?: string;
        _id?: string;
      }) =>
        !clientImages?.some((clientImg) => clientImg._id === mongoImages._id),
    );

    if (imagesToDelete.length > 0) {
      await Promise.all(
        imagesToDelete.map((image) => deleteFromCloudinary(image.publicId)),
      );
    }

    let newUploadedImages = [];
    if (newImages.length > 0) {
      const result = await Promise.all(
        newImages.map((file) => uploadToCloudinary(file.buffer)),
      );
      for (const data of result) {
        newUploadedImages.push({
          cloudinaryId: data.secure_url,
          publicId: data.public_id,
        });
      }
    }

    const finalTotalImages = [...newUploadedImages, ...clientImages];
    const updatedProduct = await Product.findOneAndUpdate(
      { _id: productID, vendorId },
      {
        name: validatedData.name,
        description: validatedData.description,
        price: validatedData.price,
        stock: validatedData.stock,
        categoryID: validatedData.categoryID,
        brand: validatedData.brand,
        color: validatedData.color,
        discount: validatedData.discount,
        status: validatedData.status,
        images: finalTotalImages,
      },
      { returnDocument: "after", runValidators: true },
    );

    if (!UpdateVendorProduct) {
      return res
        .status(404)
        .json({ success: false, message: "the product is not available." });
    }

    res.status(201).json({
      success: true,
      newProduct: updatedProduct,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteVendorProduct = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const vendorId = (req as any).user.vendorID;
    const productID = req.params.id;
    if (!vendorId || !productID) {
      res.status(403).json({
        success: false,
        message: "access unauthorized. verified vendor required",
      });
    }

    const product = await Product.findById(productID);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "product not found.",
      });
    }

    await Promise.all(
      product.images.map((image) => deleteFromCloudinary(image.publicId)),
    );

    await Product.findByIdAndDelete(product.id);

    res.status(200).json({
      success: true,
      message: "product is permenantly deleted.",
    });
  } catch (error) {
    next(error);
  }
};

export const readProduct = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product) {
      res.status(404).json({ success: false, message: "product not found." });
    }
    res.status(200).json({ success: true, product });
  } catch (error) {
    next(error);
  }
};
