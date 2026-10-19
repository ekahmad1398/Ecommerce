import express from "express";
import { FeedProducts, specificProduct, userProfile } from "../controllers/userControllers/productFeed.js";
import { GetCategories } from "../controllers/userControllers/category.js";
import auth from "../middleware/auth.js";

const router = express.Router();

router.get('/products', FeedProducts)
router.get('/products/:id', specificProduct)
router.get("/userProfile", auth, userProfile)
router.get("/GetCategories", GetCategories)

export default router