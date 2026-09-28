import express from "express";
import {
  getVendorProfile,
  registerVendor,
} from "../controllers/vendorControllers/signup_V.js";
import { getVendorFinancialStatus } from "../controllers/vendorControllers/vendorFinance.js";
import { getvendorLogisticData } from "../controllers/vendorControllers/vendorLogistic.js";
import {
  getVendorsOrders,
  UpdateSubOrderStatus,
} from "../controllers/vendorControllers/vendorOrder.js";
import {
  CreateVendorProduct,
  UpdateVendorProduct,
  deleteVendorProduct,
} from "../controllers/vendorControllers/vendorProduct.js";
import authenticate from "../middleware/auth.js";
import authorize from "../middleware/role.js"

const router = express.Router();

router.post("/register", authenticate, registerVendor);

router.use(authenticate);
router.use(authorize("vendor"));

router.post("/CreateProduct", CreateVendorProduct);
router.post("/UpdateProduct/:id", UpdateVendorProduct);
router.delete("/deleteProduct/:id", deleteVendorProduct);
router.get("/financeData", getVendorFinancialStatus);
router.get("/LogisticData", getvendorLogisticData);
router.get("/getProfile", getVendorProfile);
router.get("/vendorOrder", getVendorsOrders);
router.put("/UpdateOrderStatus", UpdateSubOrderStatus);

export default router;
