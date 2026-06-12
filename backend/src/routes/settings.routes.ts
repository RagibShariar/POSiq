import { Router } from "express";
import * as business from "../controllers/business.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/role.middleware";
import { tenantIsolation } from "../middlewares/tenant.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.use(authenticate, tenantIsolation);

// Reads are open to all staff — the POS needs tax/receipt config for cashiers.
router.get("/", asyncHandler(business.getSettings));
router.get("/receipt", asyncHandler(business.getReceiptSettings));
// Writes stay owner-only.
router.patch("/", requireRole("OWNER"), asyncHandler(business.updateSettings));
router.patch("/receipt", requireRole("OWNER"), asyncHandler(business.updateReceiptSettings));

export default router;
