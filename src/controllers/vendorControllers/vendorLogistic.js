import Product from "../../models/Product";

export const getvendorLogisticData = async (req, res, next) => {
  try {
    const vendorID = req.user.vendorID;
    const stockFilter = req.query.stock ?? "all";
    const totalProducts = await Product.countDocuments({
      vendorID,
      status: "active",
    });
    const limit = Math.min(Math.max(Number(req.query.limit || 10, 1)), 50);
    const totalPages = Math.ceil(totalProducts / limit);
    const page = Math.min(Math.max(Number(req.query.page) || 1, 1), totalPages);
    const skip = (page - 1) * limit;

    const matchCriteria = {
      vendorId: vendorID,
      status: "active",
      isDeleted: false,
    };

    if (stockFilter === "low") matchCriteria.stock = { $gte: 0, $lte: 5 };
    if (stockFilter === "medium") matchCriteria.stock = { $gte: 6, $lte: 20 };
    if (stockFilter === "healthy") matchCriteria.stock = { $gt: 20 };

    const stockData = await Product.aggregate([
      {
        $facet: {
          products: [
            {
              $match: { matchCriteria },
            },
            {
              $sort: { stock: 1 },
            },
            {
              $skip: skip,
            },
            {
              $limit: limit,
            },
            {
              $lookup: {
                from: "category",
                localField: "categoryID",
                foreignField: "_id",
                as: "categoryInfo",
              },
            },
            {
              $unwind: "$categoryInfo",
            },
            {
              $project: {
                name: 1,
                sku: 1,
                stock: 1,
                status: 1,
                thumbnailImage: { $arrayElemAt: ["$images", 0] },
                Category: "$categoryInfo.name",
                discount: 1,
                rating: 1,
              },
            },
          ],
          totalStatuses: [
            {
              $match: {
                vendorId: vendorID,
                status: { $ne: ["archieved", "pending_review"] },
              },
            },
            {
              $group: {
                _id: null,
                urgentCount: {
                  $sum: { $cond: [{ $lte: ["$stock", 5] }, 1, 0] },
                },
                mediumCount: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $gt: ["$stock", 5] },
                          { $lte: ["$stock", 20] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                healthyCount: {
                  $sum: { $cond: [{ $gt: ["$stock", 20] }, 1, 0] },
                },
              },
            },
          ],
        },
      },
    ]);

    res.status(200).json({
      success: true,
      products: stockData.products,
      statuses: stockData.totalStatuses,
      currentPage: page,
      totalPages,
    });
  } catch (error) {
    next(error);
  }
};
