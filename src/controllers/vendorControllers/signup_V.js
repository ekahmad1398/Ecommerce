import { uploadToCloudinary } from "../../middleware/upload.js";
import Vendor from "../../models/vendor.js";

export const registerVendor = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const existingUser = await Vendor.findOne({ userid: userId });
    if (existingUser) {
      res
        .status(400)
        .json({ success: false, message: "Vendor already exists." });
    }

    const companyImage = req.file;

    if (!companyImage) {
      res.status(400).json({
        success: false,
        message: "at least one company image is required for trusting issues.",
      });
    }

    const { name, companyName, lastName, country, mobilenumber, storeDescription, storeSlug } = req.body;

    if(!name, !companyName, !lastName, !country, !mobilenumber, !storeDescription, !storeSlug){
      return res.status(400).json({success:false, message:"all fields are required"})
    }

    const image = {};

    if (companyImage) {
      const result = await uploadToCloudinary(req.file.buffer);
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

export const getVendorProfile = async (req, res, next) => {
  try {
    const userId = req.user.vendorID;
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
