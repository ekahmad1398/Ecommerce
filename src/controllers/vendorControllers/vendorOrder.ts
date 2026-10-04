import SubOrders from "../../models/orderItems.js";

export const getVendorsOrders = async (req, res, next) => {
  try {
    const vendorID = req.user.vendorID;
    const totalOrders = await SubOrders.countDocuments({ vendorID });
    const limit = Math.min(Math.max(Number(req.query.limit || 10, 1)), 50);
    const totalPages = Math.ceil(totalOrders / limit);
    const page = Math.min(Math.max(Number(req.query.page) || 1, 1), totalPages);
    const skip = (page - 1) * limit;

    const subOrders = await subOrders
      .find({ vendorID, status:"processing" })
      .populate("ParentorderID", "shippingAddress createdAt customerID")
      .populate("items.productID", "name sku")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      currentPage: page,
      totalPages,
      subOrders,
      totalOrders,
    });
  } catch (error) {
    next(error);
  }
};

export const UpdateSubOrderStatus = async (req, res, next) => {
  try {
    const vendorID = req.user.vendorID;
    const productID = req.params.id;
    const status = req.body;
    const allowedStatus = ["processing", "shipped", "delivered", "cancelled"];
    if (!allowedStatus.includes(status)) {
      res.status(400).json({ success: false, message: "invalid status." });
    }

    const suborderData = await SubOrders.findOne({
      _id: productID,
      vendorID,
    }).select(`status items createdAt updatedAt subOrderTotal`);

    if (!suborderData) {
      res.status(400).json({
        success: false,
        message: "the order not found or does not belong to.",
      });
    }

    suborderData.status = status;
    await suborderData.save();

    res.status(200).json({
      success: true,
      message: `order status updated to ${status} successfully`,
      suborderData,
    });
  } catch (error) {
    next(error);
  }
};
