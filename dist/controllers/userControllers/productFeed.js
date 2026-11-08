import ProductSchema from "../../models/Product.js";
import User from "../../models/User.js";
export const specificProduct = async (req, res, next) => {
    try {
        const { id } = req.params;
        const product = await ProductSchema.findOne({
            _id: id,
            status: "active",
            isDeleted: { $ne: true },
        })
            .populate("categoryID", "name attributes")
            .populate("vendorId", "storeDescription companyName storeSlug mobilenumber Companyimage")
            .lean();
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "product not found or is no longer available on the marketplace",
            });
        }
        const categoryData = product.categoryID;
        const vendor = product.vendorId;
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
    }
    catch (error) {
        return next(error);
    }
};
export const userProfile = async (req, res, next) => {
    try {
        const userID = req.user.id;
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
    }
    catch (error) {
        return next(error);
    }
};
