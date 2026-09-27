import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    ParentorderID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "order",
      required: true,
      index: true,
    },
    vendorID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "vendor",
      required: true,
    },
    items: [
      {
        productID: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "product",
          required: true,
        },
        quantity: { type: Number, required: true, min: 1 },
        price: { type: Number, required: true },
        subtotal: { type: Number, required: true },
      },
    ],
    subOrderTotal: { type: Number, required: true },
    vendorNetEarned: { type: Number, required: true },
    platformComissionCut: { type: Number, required: true },
    status: {
      type: String,
      enum: ["shipped", "delivered", "cancelled", "pending", "processing"],
      default: "pending",
    },
    isPaidOutToVendor: { type: Boolean, default: false },
    payoutReleaseDate: { type: Date, default: Date.now() + 10 * 24 * 60 },
  },
  { timestamps: true },
);

orderItemSchema.index({ status: 1, "items.productID": 1 });
orderItemSchema.index(
  { createAt: 1 },
  { expireAfterSeconds: 3000, partialFilterExpression: { status: "pending" } },
);
orderItemSchema.index({ vendorID: -1, createdAt: -1, status: -1 });

export default mongoose.model("suborder", orderItemSchema);
