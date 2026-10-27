import mongoose from "mongoose";

const data = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    parentCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "category",
      default: null,
    },
    Image: {
      cloudinaryId: { type: String, required: true },
      publicId: { type: String, required: true },
      _id: { type: mongoose.Schema.ObjectId, auto: true },
    },
  },
  { timestamps: true },
);

data.index({ name: 1, parentCategory: 1 }, { unique: true });

export default mongoose.model("category", data);
