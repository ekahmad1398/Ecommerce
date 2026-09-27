import { model, Schema } from "mongoose";

const vendorSchema = new Schema(
  {
    userid: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    companyName: { type: String, required: true, trim: true, maxlength: 120 },
    storeSlug: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
      unique: true,
    },
    lastName: { type: String, required: true, trim: true, maxlength: 120 },
    country: { type: String, required: true, trim: true, maxlength: 120 },
    mobilenumber: { type: String, required: true, trim: true, maxlength: 20 },
    Companyimage: {
      cloudinaryId: { type: String, required: true },
      publicId: { type: String, required: true },
    },
    storeDescription: { type: String, required: true, maxlength: 2000 },
    status: {
      type: String,
      enum: ["pending", "inactive", "suspended", "active"],
      default: "pending",
      index: true,
    },
  },
  { timestamps: true },
);

vendorSchema.index({ userid: -1, status: 1 });
vendorSchema.index({ name: 1 });

export default model("vendor", vendorSchema);
