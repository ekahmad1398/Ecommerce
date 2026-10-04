import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    customerID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    totalPrice: { type: Number, required: true, min: 0 },
    paymentMethod: {
      type: String,
      default: "card",
    },
    paymentIntentId: {
      type: String,
      default: null,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "processing"],
      default: "pending",
    },
    shippingAddress: {
      phone: { type: String, required: true },
      address: { type: String, required: true },
      city: { type: String, required: true },
      country: { type: String, required: true },
      postalCode: { type: String },
    },
  },
  { timestamps: true },
);

orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index(
  { createdAt: 1 },
  {
    expireAfterSeconds: 26000,
    partialFilterExpression: { paymentStatus: "pending" },
  },
);

export default mongoose.model("order", orderSchema);
