import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    customerID: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    totalPrice: { type: Number, required: true, min: 0 },
    paymentMethod: { type: String, enum: ["cash_on_delivery", "card", "bank_transfer"], default: "cash_on_delivery" },
    paymentStatus: { type: String, enum: ["pending", "paid", "failed"], default: "pending" },
    shippingAddress: { fullName: { type: String }, phone: { type: String }, address: { type: String }, city: { type: String }, country: { type: String }, postalCode: { type: String } },
  },
  { timestamps: true }
);

orderSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model("order", orderSchema);
