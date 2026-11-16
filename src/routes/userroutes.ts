import express from "express";
import { specificProduct, userProfile } from "../controllers/userControllers/productFeed.js";
import { searchResults, getHomeCategories } from "../controllers/userControllers/category.js";
import { getUserOrders, getOrderDetails } from "../controllers/userControllers/orders.js";
import { getProductReviews, createReview } from "../controllers/userControllers/reviews.js";
import { topRated } from "../controllers/userControllers/topRated.js";
import auth from "../middleware/auth.js";

const router = express.Router();

router.get('/products/:id', specificProduct)
router.get("/userProfile", auth, userProfile)
router.get("/orders", auth, getUserOrders)
router.get("/orders/:orderId", auth, getOrderDetails)
router.get("/products/:productId/reviews", getProductReviews)
router.post("/reviews", auth, createReview)
router.get("/top-rated", topRated)
router.get("/home-categories", getHomeCategories);
router.get("/search", searchResults);

export default router