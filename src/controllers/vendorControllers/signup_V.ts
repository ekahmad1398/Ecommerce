import type { NextFunction, Request, Response } from "express";
import { uploadToCloudinary } from "../../middleware/upload.js";
import Vendor from "../../models/vendor.js";

export const registerVendor = async (req:Request, res:Response, next:NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const existingUser = await Vendor.findOne({ userid: userId });
    if (existingUser) {
      res
        .status(400)
        .json({ success: false, message: "Vendor already exists." });
    }

    const companyImage = (req as any).file;

    if (!companyImage) {
      res.status(400).json({
        success: false,
        message: "at least one company image is required for trusting issues.",
      });
    }

    const {
      name,
      companyName,
      lastName,
      country,
      mobilenumber,
      storeDescription,
      storeSlug,
    } = req.body;

    if (
      !name ||
      !companyName ||
      !lastName ||
      !country ||
      !mobilenumber ||
      !storeDescription ||
      !storeSlug
    ) {
      return res
        .status(400)
        .json({ success: false, message: "all fields are required" });
    }

    const image: { cloudinaryId: string; publicId: string } = {
      cloudinaryId: "",
      publicId: "",
    };

    if (companyImage) {
      const result = (await uploadToCloudinary((req as any).file.buffer)) as {
        secure_url: string;
        public_id: string;
      };
      image.cloudinaryId = result.secure_url;
      image.publicId = result.public_id;
    }

    const newVendors = await Vendor.create({
      userid: userId,
      name,
      companyName,
      lastName,
      storeDescription,
      storeSlug,
      country,
      mobilenumber,
      Companyimage: image,
    });

    res.status(201).json({
      success: true,
      message:
        "your vendor application has been created successfully and is in awaiting review.",
      newVendor: newVendors,
    });
  } catch (error) {
    next(error);
  }
};

export const getVendorProfile = async (req:Request, res:Response, next:NextFunction) => {
  try {
    const userId = (req as any).user.vendorID;
    const vendor = await Vendor.findById(userId);

    if (!vendor) {
      res
        .status(404)
        .json({ success: false, message: "Vendor profile not found." });
    }

    res.status(201).json({
      success: true,
      vendor,
    });
  } catch (error) {
    next(error);
  }
};
