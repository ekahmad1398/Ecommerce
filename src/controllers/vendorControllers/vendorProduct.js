import Product, { generateSKU } from "../../models/Product.js";
import category from "../../models/category.js";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
} from "../../middleware/upload.js";

export const CreateVendorProduct = async (req, res, next) => {
  try {
    const vendorID = req.user.vendorID;
    const { brand, category, color, categoryID, name, description, price, stock } = req.body;
    if (!vendorID) {
      res.status(403).json({
        success: false,
        message: "access unauthorized. verified vendor required",
      });
    }

    const incomingImages = req.file;

    const targetCategory = await category.findById(categoryID);
    if (!targetCategory) {
      res.status(400).json({
        success: false,
        message: "Selected MarketPlace category does not exist.",
      });
    }

    let imagesData = [];

    if (incomingImages && incomingImages.length > 0) {
      const result = await uploadToCloudinary(req.file.buffer);
      for (const data of result) {
        imagesData.push({
          cloudinaryId: data.secure_url,
          publicId: data.public_id,
        });
      }
    } else {
      return res
        .status(400)
        .json({ success: false, message: "at least one image is required." });
    }

    const createdSKU = generateSKU({ brand, category, color });
    const addedProduct = await Product.create({
      name,
      description,
      brand,
      category,
      stock,
      price,
      color,
      sku: createdSKU,
      vendorId: vendorID,
      images: imagesData,
    });

    res.status(201).json({
      success: true,
      newProduct: addedProduct,
    });
  } catch (error) {
    next(error);
  }
};

export const UpdateVendorProduct = async (req, res, next) => {
  try {
    const vendorId = req.user.vendorID;
    const {
      name,
      description,
      price,
      stock,
      categoryID,
      brand,
      color,
      discount,
      status,
      images,
    } = req.body;
    const productID = req.params.id;
    if (!vendorId || !productID) {
      res.status(403).json({
        success: false,
        message: "access unauthorized. verified vendor required",
      });
    }
    const newImages = req.file.buffer;

    const product = await Product.findOne({ _id: productID, vendorId });

    if (!product) {
      res.status(404).json({ success: false, message: "product not found." });
    }

    const clientImages = JSON.parse(images || "[]");
    const imagesToDelete = product.images.filter(
      (mongoImages) =>
        !clientImages.some((clientImg) => clientImg === mongoImages),
    );

    if (imagesToDelete.length > 0) {
      await Promise.all(
        imagesToDelete.map((image) => deleteFromCloudinary(image)),
      );
    }

    let newUploadedImages = [];
    if (incomingImages && incomingImages.length > 0) {
      const result = await uploadToCloudinary(newImages);
      for (const data of result) {
        newUploadedImages.push({
          cloudinaryId: data.secure_url,
          publicId: data.public_id,
        });
      }
    }

    const finalTotalImages = [...newUploadedImages, ...clientImages];
    const updatedProduct = await Product.findByIdAndUpdate(
      vendorId,
      {
        name,
        description,
        price,
        stock,
        categoryID,
        brand,
        color,
        discount,
        status,
        images: finalTotalImages,
      },
      { returnDocument: "after", runValidators: true },
    );

    res.status(201).json({
      success: true,
      newProduct: updatedProduct,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteVendorProduct = async (req, res, next) => {
  try {
    const vendorId = req.user.vendorID;
    const productID = req.params.id;
    if (!vendorId || !productID) {
      res.status(403).json({
        success: false,
        message: "access unauthorized. verified vendor required",
      });
    }

    await Product.updateOne({ _id: productID, isDeleted: true });

    res.status(200).json({
      success: true,
      message: "product is permenantly deleted.",
    });
  } catch (error) {
    next(error);
  }
};


export const readProduct = async (req,res, next)=>{
  try {
    const {id}= req.params;

    const product =  await Product.findById(id)
    if(!product){
      res.status(404).json({success:false, message:"product not found."})
    }

  } catch (error) {
   next(error) 
  }
}