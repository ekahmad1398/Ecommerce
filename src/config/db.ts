import mongoose from "mongoose";
import env from "../config.js";
const ConnectingDB = async () => {
  await mongoose.connect(env.MONGODB_URI);
};

export default ConnectingDB