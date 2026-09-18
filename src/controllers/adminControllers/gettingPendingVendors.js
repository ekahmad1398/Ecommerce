import vendor from "../../models/vendor";

export const gettingVendors = async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit || 10, 1)), 40);
    const totalVendors = await vendor.countDocuments({ status: statusFilter });
    const totalPages = Math.ceil(totalVendors / limit);
    const page = Math.min(Math.max(Number(req.query.page) || 1, 1), totalPages);
    const skip = (page - 1) * limit;
    const statusFilter = req.query.status || "pending";

    const vendors = await vendor
      .find({ status: statusFilter })
      .populate("User", "email isEmailVerified")
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit);

      
    res.status(200).json({
      success: true,
      cuurentPage: page,
      totalPages,
      totalVendors,
      vendors,
    });
  } catch (error) {
    next(error);
  }
};
