import Product from "../../models/Product.js";
export const getVendorProducts = async (req, res, next) => {
    try {
        const vendorID = req.user?.vendorID;
        const products = await Product.find({
            vendorId: vendorID,
            isDeleted: false,
        })
            .populate("categoryID", "name")
            .sort({ createdAt: -1 });
        return res.status(200).json({ success: true, products });
    }
    catch (error) {
        return next(error);
    }
};
