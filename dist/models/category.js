import mongoose from "mongoose";
const imageSchema = new mongoose.Schema({
    cloudinaryId: { type: String, required: true },
    publicId: { type: String, required: true },
});
const data = new mongoose.Schema({
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
    Image: { type: imageSchema, default: undefined },
    ChildCount: { type: Number, default: 0 },
    ProductCount: { type: Number, default: 0 },
}, { timestamps: true });
data.index({ name: 1, parentCategory: 1 }, { unique: true });
data.index({ parentCategory: 1, createdAt: -1 });
export default mongoose.model("category", data);
