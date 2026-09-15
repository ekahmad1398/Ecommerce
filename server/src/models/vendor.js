import { model, Schema } from "mongoose";

const vendorSchema = new Schema(
  {
    userid: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    lastName: { type: String, required: true, trim: true, maxlength: 120 },
    country: { type: String, required: true, trim: true, maxlength: 120 },
    mobilenumber: { type: String, required: true, trim: true, maxlength: 20 },
  },
  { timestamps: true }
);

export default model("Vendor", vendorSchema);