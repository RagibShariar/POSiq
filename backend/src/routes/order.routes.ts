import { Router } from "express";
import * as order from "../controllers/order.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/role.middleware";
import { tenantIsolation } from "../middlewares/tenant.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();
router.use(authenticate, tenantIsolation);

router.get("/", asyncHandler(order.listOrders));
router.post("/", asyncHandler(order.createOrder));
router.get("/refunds", requireRole("OWNER", "MANAGER"), asyncHandler(order.listRefunds));
router.get("/:id", asyncHandler(order.getOrder));
router.patch("/:id/void", requireRole("OWNER", "MANAGER"), asyncHandler(order.voidOrder));
router.get("/:id/receipt", asyncHandler(order.getReceipt));
router.post("/:id/receipt/print", asyncHandler(order.getReceipt)); // same data, frontend handles print
router.post("/:id/refund", requireRole("OWNER", "MANAGER"), asyncHandler(order.refundOrder));

export default router;
