import mongoose from "mongoose";


const resetLinkPassSchema = new mongoose.Schema(
    {
        email: { type: String, required: true, unique: true },
        token: { type: String, required: true },
        expiresAt: { type: Date, required: true, expires: 1500 } // Token expires in 1 hour
    },
);
export default mongoose.model("ResetLinkPass", resetLinkPassSchema);
