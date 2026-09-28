
export const getAdminOrderFeed = async (req, res, next) => {
  try {
    const totalOrders = await order.countDocuments();
    const limit = Math.min(Math.max(Number(req.query.limit || 10, 1)), 50);
    const totalPages = Math.ceil(totalOrders / limit);
    const page = Math.min(Math.max(Number(req.query.page) || 1, 1), totalPages);
    const skip = (page - 1) * limit;
    const orders = await order
      .find()
      .populate("customerID", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      currentPage: page,
      totalPages,
      totalOrders,
      orders,
    });
  } catch (error) {
    next(error);
  }
};

export const getSuborders = async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit || 10, 1)), 50);
    const requestePage = Math.max(1, parseInt(req.query.page) || 1);
    const skip = (requestePage - 1) * limit;
    const ledgerBalance = await orderitems.aggregate([
      {
        $match: {
          status: { $in: ["shipped", "delivered", "processing"] },
        },
      },
      {
        $group: {
          _id: "$vendorID",
          totalGrossSales: { $sum: "$subOrderTotal" },
          totalVendorNetEarning: { $sum: "$vendorNetEarned" },
          totalPlatfromCommision: { $sum: "$platformComissionCut" },
        },
      },
      {
        $sort: {
          totalVendorNetEarning: -1,
        },
      },
      {
        $lookup: {
          from: "vendor",
          localField: "_id",
          foreignField: "_id",
          as: "VendorDetails",
        },
      },
      { $unwind: "$VendorDetails" },
      {
        $project: {
          _id: 0,
          vendorID: "$_id",
          BusinessName: "$VendorDetails.companyName",
          grossSales: "$totalGrossSales",
          vendorPayoutBalance: "$totalVendorNetEarning",
          platfromRevenue: "$totalPlatfromCommision",
        },
      },
      {
        $facet: {
          metaData: [{ $count: "totalVendors" }],
          ledgerData: [{ $skip: skip }, { $limit: limit }],
        },
      },
    ]);

    return res.status(200).json({
      data,
      meta: { total, page: Number(page), limit: Number(limit) },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};


export const getSuborderById = async (req, res) => {
  try {
    const suborder = await Suborder.findById(req.params.id)
      .populate("orderID")
      .populate("vendorID")
      .populate("productID");
    if (!suborder) return res.status(404).json({ error: "Suborder not found" });
    return res.status(200).json(suborder);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};


export const updateSuborder = async (req, res) => {
  try {
    const allowedUpdates = [
      "quantity",
      "price",
      "status",
      "platformComissionCut",
      "vendorNetEarned",
      "vendorID",
      "productID",
      "orderID",
    ];
    const updates = Object.keys(req.body);
    const isValid = updates.every((u) => allowedUpdates.includes(u));
    if (!isValid) return res.status(400).json({ error: "Invalid update fields" });

    const suborder = await Suborder.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
      .populate("orderID")
      .populate("vendorID")
      .populate("productID");

    if (!suborder) return res.status(404).json({ error: "Suborder not found" });
    return res.status(200).json(suborder);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

export const deleteSuborder = async (req, res) => {
  try {
    const suborder = await Suborder.findByIdAndDelete(req.params.id);
    if (!suborder) return res.status(404).json({ error: "Suborder not found" });
    return res.status(204).send();
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};
