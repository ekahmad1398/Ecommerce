import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    // `unique` creates an index: MongoDB can find emails quickly and prevents duplicates.
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    isEmailVerified: { type: Boolean, default: false },
    profileImage: { type: String, default: null },
    addresses: [
      {
        city: { type: String, default: null },
        country: { type: String, default: null },
        postalCode: { type: String, default: null },
        phoneNumber: { type: String, default: null },
        created_at: { type: Date, default: Date.now }
      }
    ],
    status: { type: String, enum: ["active", "inactive", "blocked"], default: "active" }
    

    

  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
