import type { NextFunction, Request, Response } from "express";
import {
  deleteFromCloudinary,
  uploadToCloudinary,
} from "../../middleware/upload.js";
import Vendor from "../../models/vendor.js";
import z from "zod";

const updateVendorProfileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  lastName: z.string().trim().min(2).max(120),
  country: z.string().trim().min(2).max(120),
  mobilenumber: z
    .string()
    .trim()
    .regex(/^\+?[1-9]\d{7,14}$/, "Enter a valid phone number."),
  companyName: z.string().trim().min(2).max(120),
  storeSlug: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .regex(/^[a-zA-Z0-9-]+$/, "Store URL can contain letters, numbers, and hyphens."),
  storeDescription: z.string().trim().min(2).max(2000),
});

export const registerVendor = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = (req as any).user.id;
    if ((req as any).user.role === "admin") {
      return res
        .status(400)
        .json({ success: false, message: "Admin cannot become vendor." });
    }
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
      image.cloudinaryId = result.public_id;
      image.publicId = result.secure_url;
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

export const getVendorProfile = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const vendorId = (req as any).user?.vendorID;
    const vendorProfile = await Vendor.findById(vendorId);

    if (!vendorProfile) {
      return res
        .status(404)
        .json({ success: false, message: "Vendor profile not found." });
    }

    return res.status(200).json({
      success: true,
      vendor: vendorProfile,
    });
  } catch (error) {
    next(error);
  }
};

export const updateVendorProfile = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  let replacementImageId: string | undefined;
  try {
    const vendorId = (req as any).user?.vendorID;
    if (!vendorId) {
      return res.status(401).json({
        success: false,
        message: "A vendor account is required.",
      });
    }

    const parsedBody = updateVendorProfileSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({
        success: false,
        message: "Please check the profile fields and try again.",
        errors: parsedBody.error.issues,
      });
    }

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor profile not found.",
      });
    }

    const imageFile = (req as any).file as Express.Multer.File | undefined;
    let replacementImage:
      | { cloudinaryId: string; publicId: string }
      | undefined;
    if (imageFile) {
      const uploadResult = await uploadToCloudinary(imageFile.buffer);
      if (!uploadResult) {
        return res.status(500).json({
          success: false,
          message: "Store image upload failed.",
        });
      }
      replacementImageId = uploadResult.public_id;
      replacementImage = {
        cloudinaryId: uploadResult.public_id,
        publicId: uploadResult.secure_url,
      };
    }

    const updatedVendor = await Vendor.findByIdAndUpdate(
      vendorId,
      {
        ...parsedBody.data,
        ...(replacementImage ? { Companyimage: replacementImage } : {}),
      },
      { returnDocument: "after", runValidators: true },
    );
    if (!updatedVendor) {
      if (replacementImageId) await deleteFromCloudinary(replacementImageId);
      return res.status(404).json({
        success: false,
        message: "Vendor profile not found.",
      });
    }

    if (replacementImageId) {
      await deleteFromCloudinary(vendor.Companyimage?.cloudinaryId);
      replacementImageId = undefined;
    }

    return res.status(200).json({
      success: true,
      message: "Vendor profile updated successfully.",
      vendor: updatedVendor,
    });
  } catch (error) {
    if (replacementImageId) await deleteFromCloudinary(replacementImageId);
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      return res.status(409).json({
        success: false,
        message: "That store URL is already in use.",
      });
    }
    return next(error);
  }
};
