import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 2000 },
    price: { type: Number, required: true, min: 0 },
    stock: { type: Number, required: true, min: 0, default:1 },
    category: { type: mongoose.Schema.Types.ObjectId, ref:"category" , required: true },
    brand: { type: String, trim: true, maxlength: 80, default: "GEN" }, // Default helps SKU generation if missing
    sku: { type: String, trim: true, uppercase: true, required: true, maxlength: 80 },
    color: { type: String, trim: true, maxlength: 80, default: "ANY" }, // Default helps SKU generation if missing
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true },
    images: [{ cloudinaryId: { type: String, required: true }, publicId: { type: String, required: true } }],
    discount: { type: Number, default: 0, min: 0, max: 100 },
    isActive: { type: Boolean, default: true },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

productSchema.index({ name: 1 });
productSchema.index({ category: 1 });
productSchema.index({ isActive: 1, createdAt: -1 });
productSchema.index({ vendorId: 1, sku: 1 }, { unique: true })


export default mongoose.model("product", productSchema);
export function generateSKU(brand, category, color) {
  const clean = (str) => {
    if (!str) return;
    return str.replace(/[^a-zA-Z0-9]/g, "").substring(0, 3).toUpperCase();
  };
  return `${clean(brand)}-${clean(category)}-${clean(color)}`;
}
