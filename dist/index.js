import "dotenv/config";
import express from "express";
import connectDB from "./config/db.js";
import stripeWebhook from "./routes/stripe_webhook.js";
import vendorRoutes from "./routes/vendorRoutes.js";
import AuthRoutes from "./routes/authroutes.js";
import userRoutes from "./routes/userroutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import cookieParser from "cookie-parser";
import rotateCookie from "./routes/rotateCookie.js";
import cors from "cors";
const app = express();
app.use(cookieParser());
app.use(cors());
app.use("/api/v1/webhooks", stripeWebhook);
app.use(express.json());
const PORT = process.env.PORT;
const startServer = async () => {
    (await connectDB(),
        // await forwardToApp(),
        // we only turn this on when we are in production level and out of here
        // cront_worker(),
        app.listen(PORT));
};
app.use("/vendor", vendorRoutes);
app.use("/authentication", AuthRoutes);
app.use("/user", userRoutes);
app.use("/admin", adminRoutes);
app.use("/api", rotateCookie);
startServer();
