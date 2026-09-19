import { model, Schema } from "mongoose";

const vendorSchema = new Schema(
  {
    userid: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    companyName: { type: String, required: true, trim: true, maxlength: 120 },
    lastName: { type: String, required: true, trim: true, maxlength: 120 },
    country: { type: String, required: true, trim: true, maxlength: 120 },
    mobilenumber: { type: String, required: true, trim: true, maxlength: 20 },
    status: {
      type: String,
      enum: ["pending", "inactive", "suspended", "active"],
      default: "pending",
      index:true
    },
  },
  { timestamps: true },
);

export default model("vendor", vendorSchema);
