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
  readProduct,
} from "../controllers/vendorControllers/vendorProduct.js";
import authenticate from "../middleware/auth.js";
import authorize from "../middleware/role.js";
import upload from "../middleware/upload.js";

const router = express.Router();

router.use(authenticate);
router.post("/register", upload.single("companyimage"), registerVendor);
router.use(authorize("vendor"));

router.post("/CreateProduct", upload.array("imagestoUpload", 3), CreateVendorProduct);
router.post("/UpdateProduct/:id", upload.array("imagestoUpload",3), UpdateVendorProduct);
router.delete("/deleteProduct/:id", deleteVendorProduct);
router.get("/readProduct/:id", readProduct);
router.get("/financeData", getVendorFinancialStatus);
router.get("/LogisticData", getvendorLogisticData);
router.get("/getProfile", getVendorProfile);
router.get("/vendorOrder", getVendorsOrders);
router.put("/UpdateOrderStatus", UpdateSubOrderStatus);

export default router;
