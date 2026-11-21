import productSchema from "../../models/Product.js";
export const GetProducts = async (req, res, next) => {
    try {
        const { isActive, search, status } = req.query;
        const matchStage = {
            isDeleted: { $ne: true },
        };
        if (typeof search === "string" && search.trim()) {
            matchStage.name = { $regex: search.trim(), $options: "i" };
        }
        const statusFilter = typeof status === "string" && status.trim()
            ? status.trim()
            : isActive === "true"
                ? "active"
                : isActive === "false"
                    ? "inactive"
                    : null;
        if (statusFilter) {
            matchStage.status = statusFilter;
        }
        const limit = Math.min(Math.max(Number(req.query.limit || 10), 1), 50);
        const totalProducts = await productSchema.countDocuments(matchStage);
        const totalPages = Math.max(1, Math.ceil(totalProducts / limit));
        const page = Math.min(Math.max(Number(req.query.page) || 1, 1), totalPages);
        const skip = (page - 1) * limit;
        const products = await productSchema.aggregate([
            { $match: matchStage },
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
                $lookup: {
                    from: "vendors",
                    localField: "vendorId",
                    foreignField: "_id",
                    as: "VendorInfo",
                },
            },
            {
                $unwind: { path: "$VendorInfo", preserveNullAndEmptyArrays: true },
            },
            {
                $project: {
                    _id: 1,
                    name: 1,
                    price: 1,
                    stock: 1,
                    status: 1,
                    createdAt: 1,
                    vendorId: "$vendorId",
                    businessName: "$VendorInfo.companyName",
                    PhoneNumber: "$VendorInfo.mobilenumber",
                    images: 1,
                },
            },
        ]);
        res.status(200).json({
            success: true,
            totalProducts,
            totalPages,
            currentPage: page,
            products,
        });
    }
    catch (error) {
        next(error);
    }
};
