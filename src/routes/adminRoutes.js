import express from "express";

import {
  createCategory,
  getAllCategories,
  deleteCategory,
} from "../controllers/adminControllers/Category.js";
import authenticate from "../middleware/auth.js";
import authorize from "../middleware/role.js";
import {
  gettingVendors,
  approaveVendor,
} from "../controllers/adminControllers/gettingPendingVendors.js";
import {
  getAdminOrderFeed,
  getVendorBalanceLedger,
} from "../controllers/adminControllers/order.js";
import { getAdminDashboard } from "../controllers/adminControllers/platformanalytics.js";
import { GetProducts } from "../controllers/adminControllers/products.js";

const router = express.Router();

router.use(authenticate);

router.post("/createCategory", authorize("vendor", "admin"), authorize("admin", "vendor"), createCategory);
router.get("/getAllCategories", authorize("vendor", "admin"), getAllCategories);

router.use(authorize("admin"));

router.post("/deleteCategory:id", deleteCategory);
router.get("/getVendors", gettingVendors);
router.get("/getAdminOrderFeed", getAdminOrderFeed);
router.get("/getVendorBalanceLedger", getVendorBalanceLedger);
router.get("/getAdminDashboard", getAdminDashboard);
router.get("/GetProducts", GetProducts);
router.post("/approaveVendor/:id", approaveVendor);

export default router;
