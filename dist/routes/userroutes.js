import express from "express";
import { specificProduct, userProfile } from "../controllers/userControllers/productFeed.js";
import { searchResults, getHomeCategories } from "../controllers/userControllers/category.js";
import auth from "../middleware/auth.js";
const router = express.Router();
// router.get('/products', FeedProducts)
router.get('/products/:id', specificProduct);
router.get("/userProfile", auth, userProfile);
router.get("/home-categories", getHomeCategories);
router.get("/search", searchResults);
export default router;
