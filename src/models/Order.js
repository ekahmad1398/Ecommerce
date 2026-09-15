import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    items: [{
      product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
      quantity: { type: Number, required: true, min: 1 }, subtotal: { type: Number, required: true, min: 0 },
      vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true },
      status: { type: String, enum: ["pending", "processing", "shipped", "delivered", "cancelled"], default: "pending" },
      subtotal: { type: Number, required: true, min: 0 }, discount: { type: Number, default: 0, min: 0 },
      stockRestored: { type: Boolean, default: false, select: false }
    }],
    shippingAddress: { fullName: { type: String }, phone: { type: String }, address: { type: String }, city: { type: String }, country: { type: String }, postalCode: { type: String } },
    totalPrice: { type: Number, required: true, min: 0 },
    paymentMethod: { type: String, enum: ["cash_on_delivery", "card", "bank_transfer"], default: "cash_on_delivery" },
    paymentStatus: { type: String, enum: ["pending", "paid", "failed", "refunded"], default: "pending" },
  },
  { timestamps: true }
);

orderSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model("Order", orderSchema);
