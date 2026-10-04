import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 2000, required: true },
    price: { type: Number, required: true, min: 0 },
    stock: { type: Number, required: true, min: 0, default: 1 },
    categoryID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "category",
      required: true,
    },
    brand: { type: String, trim: true, maxlength: 80, default: "General" },
    sku: {
      type: String,
      trim: true,
      uppercase: true,
      required: true,
      maxlength: 80,
      unique:true
    },
    color: { type: String, trim: true, maxlength: 80, default: "ANY" },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },
    images: [
      {
        cloudinaryId: { type: String, required: true },
        publicId: { type: String, required: true },
        _id: { type: mongoose.Schema.ObjectId, auto: true },
      },
    ],
    discount: { type: Number, default: 0, min: 0, max: 100 },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0, min: 0 },
    isDeleted: { type: Boolean, default: false, select: false },
    status: {
      type: String,
      enum: ["archieved", "banned", "active", "inactive"],
      default: "active",
    },
    attributes: [
      {
        key: { type: String },
        value: { type: String },
        _id: { type: mongoose.Schema.ObjectId, auto: true },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        delete ret.isDeleted;
        delete ret.__v;
        if (Array.isArray(ret.images)) {
          for (const image of ret.images) {
            delete image.cloudinaryId;
          }
        }

        return ret;
      },
    },
  },
);

productSchema.index({ name: 1 });
productSchema.index({ category: 1 });
productSchema.index({ vendorId: 1, status: 1, stock: 1 });
productSchema.index({ vendorId: 1, sku: 1 }, { unique: true });

export default mongoose.model("product", productSchema);

export function generateSKU({ name, brand = "GEN", color }) {
  const clean = (str) => {
    if (!str) return;
    return str
      .replace(/[^a-zA-Z0-9]/g, "")
      .substring(0, 3)
      .toUpperCase();
  };
  return `${clean(name)}-${clean(brand)}-${clean(color)}`;
}
