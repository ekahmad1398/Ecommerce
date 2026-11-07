import mongoose from "mongoose";
const imageSchema = new mongoose.Schema({
    cloudinaryId: { type: String, required: true },
    publicId: { type: String, required: true },
});
const attributeDefinitionSchema = new mongoose.Schema({
    key: { type: String, required: true, trim: true, lowercase: true, maxlength: 64 },
    label: { type: String, required: true, trim: true, maxlength: 100 },
    type: {
        type: String,
        required: true,
        enum: ["text", "number", "boolean", "select"],
    },
    unit: { type: String, trim: true, maxlength: 24 },
    options: { type: [String], default: undefined },
    required: { type: Boolean, default: false },
    filterable: { type: Boolean, default: true },
}, { _id: false });
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
    brands: { type: [String], trim: true, default: [] },
    ChildCount: { type: Number, default: 0 },
    attributes: { type: [attributeDefinitionSchema], default: [] },
}, { timestamps: true });
data.index({ name: 1, parentCategory: 1 }, { unique: true });
data.index({ parentCategory: 1, createdAt: -1 });
export default mongoose.model("category", data);
