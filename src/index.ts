import "dotenv/config";
import express from "express";
import connectDB from "./config/db.js";
import forwardToApp from "./config/ngrok.js";
import stripeWebhook from "./routes/stripe_webhook.js";
import vendorRoutes from "./routes/vendorRoutes.js";
import AuthRoutes from "./routes/authroutes.js";
import userRoutes from "./routes/userroutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import cron_worker from "./utils/cron_worker.js";
import cookieParser from "cookie-parser";
import rotateCookie from "./routes/rotateCookie.js";
import cors from "cors";

const allowedOrigins = ["http://100.97.73.17:3000"];

const app = express();
app.use(cookieParser());
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  }),
);
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
