import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    orderID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "order",
      required: true,
      index: true,
    },
    vendorID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "vendor",
      required: true,
      index: true,
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
        platformComissionCut: { type: Number, required: true },
        vendorNetEarned: { type: Number, required: true },
      },
    ],
    subOrderTotal: { type: Number, required: true },
    status: {
      type: String,
      enum: ["processing", "shipped", "delivered", "cancelled"],
      default: "processing",
    },
    isPaidOutToVendor: { type: Boolean, default: false },
  },
  { timestamps: true },
);

orderItemSchema.index({ status: 1, "items.productID": 1 });

export default mongoose.model("suborder", orderItemSchema);
