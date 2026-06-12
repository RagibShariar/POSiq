import { Router } from "express";
import * as business from "../controllers/business.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/role.middleware";
import { tenantIsolation } from "../middlewares/tenant.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.use(authenticate, tenantIsolation, requireRole("OWNER", "MANAGER"));

router.get("/", asyncHandler(business.getSettings));
router.patch("/", requireRole("OWNER"), asyncHandler(business.updateSettings));
router.get("/receipt", asyncHandler(business.getReceiptSettings));
router.patch("/receipt", requireRole("OWNER"), asyncHandler(business.updateReceiptSettings));

export default router;
