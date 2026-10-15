import ProductSchema from "../../models/Product.js";
import User from "../../models/User.js";
export const FeedProducts = async (req, res, next) => {
    try {
        const { category, search, minPrice, maxPrice, rating, discount } = req.query;
        const matchCriteria = { status: "active" };
        if (category) {
            matchCriteria.category = String(category);
        }
        if (search) {
            matchCriteria.name = { $regex: String(search), $options: "i" };
        }
        if (minPrice || maxPrice) {
            matchCriteria.price = {};
            if (minPrice)
                matchCriteria.price.$gte = Number(minPrice);
            if (maxPrice)
                matchCriteria.price.$lte = Number(maxPrice);
        }
        if (rating) {
            matchCriteria.rating = {};
            matchCriteria.rating.$gte = Number(rating);
        }
        if (discount) {
            matchCriteria.discount = {};
            matchCriteria.discount.$gte = Number(discount);
        }
        const totalProducts = await ProductSchema.countDocuments(matchCriteria);
        const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);
        const totalPages = Math.ceil(totalProducts / limit);
        const page = Math.min(Math.max(Number(req.query.page) || 1, 1), Math.max(totalPages, 1));
        const skip = (page - 1) * limit;
        const products = await ProductSchema.find(matchCriteria)
            .populate("categoryID", "name")
            .populate("vendorId", "name storeSlug companyName")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();
        const formatedData = products.map((product) => {
            const vendor = product.vendorId;
            const category = product.categoryID;
            return {
                id: product._id,
                storeSlug: vendor.storeSlug,
                price: product.price,
                stock: product.stock,
                companyName: vendor.companyName,
                storeName: vendor.name,
                categoryName: category.name,
                thumbNailImage: product.images[0],
                attributes: product.attributes
            };
        });
        res.status(200).json({
            success: true,
            currentPage: page,
            totalPages,
            totalProducts,
            product: formatedData,
        });
    }
    catch (error) {
        next(error);
    }
};
export const specificProduct = async (req, res, next) => {
    try {
        const { id } = req.params;
        const product = await ProductSchema.findOne({ _id: id, status: "active" })
            .populate("categoryID", "name attributes")
            .populate("vendorId", "storeDescription companyName storeSlug mobilenumber Companyimage")
            .lean();
        if (!product) {
            res
                .status(404)
                .json({
                success: false,
                message: "product not found or is no longer available on the marketplace",
            });
            return;
        }
        const category = product.categoryID;
        const vendor = product.vendorId;
        res.status(200).json({
            success: true,
            id: product._id,
            name: product.name,
            sku: product.sku,
            price: product.price,
            stock: product.stock,
            description: product.description,
            images: product.images,
            category: {
                allowedFilters: category.attributes,
                name: category.name,
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
        next(error);
    }
};
export const userProfile = async (req, res, next) => {
    try {
        const userID = req.user.id;
        const userData = await User.findById(userID);
        if (!userData) {
            res.status(404).json({ success: false, message: "User not found" });
            return;
        }
        res.status(200).json({
            success: true,
            userData,
        });
    }
    catch (error) {
        next(error);
    }
};
