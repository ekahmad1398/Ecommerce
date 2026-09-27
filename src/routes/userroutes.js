import express from "express";
import { FeedProducts, specificProduct } from "../controllers/userControllers/productFeed.js";
import auth from "../middleware/auth.js";

const router = express.Router();

router.get('/products', auth, FeedProducts)
router.get('/products/:id', auth, specificProduct)


export default router