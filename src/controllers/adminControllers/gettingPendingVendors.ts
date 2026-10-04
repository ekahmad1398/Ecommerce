import vendor from "../../models/vendor.js";
import User from "../../models/User.js";

export const gettingVendors = async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit || 10, 1)), 40);
    const statusFilter = req.query.status || "pending";
    const totalVendors = await vendor.countDocuments({ status: statusFilter });
    const totalPages = Math.ceil(totalVendors / limit);
    const page = Math.min(Math.max(Number(req.query.page) || 1, 1), totalPages);
    const skip = (page - 1) * limit;

    const vendors = await vendor
      .find({ status: statusFilter })
      .populate("userid", "email isEmailVerified")
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

export const approaveVendor = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!id || !userId) {
      return res.status(400).json({
        success: false,
        message: "the id is required to perform the action.",
      });
    }

    const vendorstatus = await vendor.findByIdAndUpdate(
      { _id: id },
      { status: "active" },
      { returnDocument: "after" },
    );

    const UpdateUser = await User.findByIdAndUpdate(
      userId,
      { role: "vendor" },
      { returnDocument: "after" },
    );

    res.status(200).json({
      success: true,
      message: `${vendor.name} now become an active seller.`,
    });
  } catch (error) {
    next(error);
  }
};
