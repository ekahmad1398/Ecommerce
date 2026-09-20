
import Suborder from "../models/suborder.js";


export const createSuborder = async (req, res) => {
  try {
    const suborder = new Suborder(req.body);
    await suborder.save();
    return res.status(201).json(suborder);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

export const getSuborders = async (req, res) => {
  try {
    const { page = 1, limit = 25, sort = "-createdAt", ...filters } = req.query;
    const skip = (Math.max(1, Number(page)) - 1) * Number(limit);
    const query = {};

    // Allow filtering by orderID, vendorID, productID, status
    if (filters.orderID) query.orderID = filters.orderID;
    if (filters.vendorID) query.vendorID = filters.vendorID;
    if (filters.productID) query.productID = filters.productID;
    if (filters.status) query.status = filters.status;

    const [data, total] = await Promise.all([
      Suborder.find(query)
        .sort(sort)
        .skip(skip)
        .limit(Number(limit))
        .populate("orderID")
        .populate("vendorID")
        .populate("productID"),
      Suborder.countDocuments(query),
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
