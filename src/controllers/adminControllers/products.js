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

    const productAggregate = await productSchema.aggregate([
      { $match: matchstage },
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
      ...(search
        ? [
            {
              $match: {
                $or: [
                  { name: { $regex: search, $options: "i" } },
                  {
                    "$VendorInfo.companyName": {
                      $regex: search,
                      $options: "i",
                    },
                  },
                ],
              },
            },
          ]
        : []),

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
        },
      },

      {
        $facet: {
          metaData: [{ $count: "total" }],
          vendorData: [
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit },
          ],
        },
      },
    ]);
    const products = productAggregate[0].vendorData;
    const totalProducts = productAggregate[0].metaData[0].total;
    const limit = Math.min(Math.max(Number(req.query.limit || 10, 1)), 50);
    const totalPages = Math.ceil(totalProducts / limit);
    const page = Math.min(Math.max(Number(req.query.page) || 1, 1), totalPages);
    const skip = (page - 1) * limit;
    res.status(200).json({
      totalProducts,
      totalPages,
      limit,
      skip,
      products
    })
  } catch (error) {
    next(error);
  }
};
