import { Router } from "express";
import * as admin from "../controllers/admin.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/role.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

// SUPER_ADMIN only — requireRole with no allowed roles still lets SUPER_ADMIN through
router.use(authenticate, requireRole());

router.get("/businesses", asyncHandler(admin.listBusinesses));
router.get("/businesses/:id", asyncHandler(admin.getBusiness));
router.patch("/businesses/:id", asyncHandler(admin.updateBusiness));
router.post("/businesses/:id/suspend", asyncHandler(admin.suspendBusiness));
router.get("/stats", asyncHandler(admin.getStats));
router.get("/ai-usage", asyncHandler(admin.getAiUsage));
router.post("/impersonate/:id", asyncHandler(admin.impersonate));

export default router;
