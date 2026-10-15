import mongoose from "mongoose";
import env from "../config.js";
 const ConnectingDB = async () => {

  try {
    await mongoose.connect(env.MONGODB_URI);
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.log(error);
  }
};

export default ConnectingDB