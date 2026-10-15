import productSchema from "../../models/User.js";
export const GetProducts = async (req, res, next) => {
    try {
        const matchstage = {};
        const { isActive, search } = req.query;
        if (isActive) {
            matchstage.isActive = isActive;
        }
        if (search) {
            matchstage.search = search;
        }
        const limit = Math.min(Math.max(Number(req.query.limit || 10)), 50);
        const totalPages = await productSchema.countDocuments();
        const page = Math.min(Math.max(Number(req.query.page) || 1, 1), totalPages);
        const skip = (page - 1) * limit;
        const productAggregate = await productSchema.aggregate([
            { $match: matchstage },
            {
                $facet: {
                    vendorData: [
                        ...(search
                            ? [
                                {
                                    $match: { name: { $regex: search, $options: "i" } },
                                },
                            ]
                            : []),
                        { $sort: { createdAt: -1 } },
                        { $skip: skip },
                        { $limit: limit },
                        {
                            $lookup: {
                                from: "vendor",
                                localField: "vendorId",
                                foreignField: "_id",
                                as: "VendorInfo",
                            },
                        },
                        {
                            $unwind: "$VendorInfo",
                        },
                        {
                            $project: {
                                name: 1,
                                price: 1,
                                stock: 1,
                                isActive: 1,
                                createdAt: 1,
                                vendorId: "$vendorInfo._id",
                                "vendor.businessName": "$vendorInfo.companyName",
                                PhoneNumber: "$vendorInfo.mobilenumber",
                                images: 1,
                            },
                        },
                    ],
                },
            },
        ]);
        const products = productAggregate[0].vendorData;
        const totalProducts = productAggregate[0].metaData[0].total;
        res.status(200).json({
            totalProducts,
            totalPages,
            products,
        });
    }
    catch (error) {
        next(error);
    }
};
