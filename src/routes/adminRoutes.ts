import express from "express";

import {
  createCategory,
  getAllCategories,
  deleteCategory,
  updateCategory,
  specificCategoryName,
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
import upload from "../middleware/upload.js";

const router = express.Router();

router.use(authenticate);

router.get("/getAllCategories", authorize("vendor", "admin"), getAllCategories);
router.get("/specificCategoryName", specificCategoryName)

router.use(authorize("admin"));

router.put("/updateCategory/:id", upload.single("image"), updateCategory);
router.post("/createCategory", upload.single("image"), createCategory);
router.delete("/deleteCategory/:id", deleteCategory);
router.get("/getVendors", gettingVendors);
router.get("/getAdminOrderFeed", getAdminOrderFeed);
router.get("/getVendorBalanceLedger", getVendorBalanceLedger);
router.get("/getAdminDashboard", getAdminDashboard);
router.get("/GetProducts", GetProducts);
router.post("/approaveVendor/:id", approaveVendor);

export default router;
