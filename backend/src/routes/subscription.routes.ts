import { Router } from "express";
import * as subscription from "../controllers/subscription.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/role.middleware";
import { tenantIsolation } from "../middlewares/tenant.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.use(authenticate, tenantIsolation, requireRole("OWNER"));

router.get("/", asyncHandler(subscription.getSubscription));
router.post("/upgrade", asyncHandler(subscription.upgrade));
router.post("/cancel", asyncHandler(subscription.cancel));
router.get("/invoices", asyncHandler(subscription.listInvoices));

export default router;
