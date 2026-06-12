import { Router } from "express";
import * as business from "../controllers/business.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/role.middleware";
import { tenantIsolation } from "../middlewares/tenant.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.use(authenticate, tenantIsolation, requireRole("OWNER"));

router.get("/", asyncHandler(business.getBusiness));
router.patch("/", asyncHandler(business.updateBusiness));
router.post("/logo", asyncHandler(business.setLogo));
router.delete("/", asyncHandler(business.deleteBusiness));

export default router;
