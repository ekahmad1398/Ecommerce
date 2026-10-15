import express from "express";
import { FeedProducts, specificProduct, userProfile } from "../controllers/userControllers/productFeed.js";
import auth from "../middleware/auth.js";

const router = express.Router();

router.get('/products', FeedProducts)
router.get('/products/:id', specificProduct)
router.get("/userProfile", userProfile)

export default router