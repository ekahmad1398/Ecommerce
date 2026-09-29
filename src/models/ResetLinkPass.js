import mongoose from "mongoose";


const resetLinkPassSchema = new mongoose.Schema(
    {
        email: { type: String, required: true, unique: true },
        token: { type: String, required: true },
        expiresAt: { type: Date, required: true, default:Date.now(), expires: 900 } 
    },
);
export default mongoose.model("ResetLinkPass", resetLinkPassSchema);
