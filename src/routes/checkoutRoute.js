import express from "express"
import { checkout } from "../controllers/userControllers/checkout"
import auth from '../middleware/auth.js'
import { roleMiddleware } from "../middleware/role.js"

const router = express.Router()

router.post('/checkout', auth, roleMiddleware("user", "admin", "vendor"), checkout)

export default router