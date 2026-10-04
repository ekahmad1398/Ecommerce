import express from "express";
const router = express.Router();

import {
  createAccount,
  otprequest,
  loginfun,
  logout,
} from "../controllers/auth/signin&signup.js";

import {
  forgetpassword,
  resetLink,
} from "../controllers/auth/forgetpass.js";
import authorize from "../middleware/auth.js";

router.post("/createAccount", createAccount);
router.post("/otpRequest", otprequest);
router.post("/login", loginfun);
router.post("/logout", authorize, logout);
router.post("/forgetpassword", forgetpassword);
router.put("/forgetpassword/:token", resetLink);


export default router;
