import { Router } from "express";
import * as ai from "../controllers/ai.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/role.middleware";
import { tenantIsolation } from "../middlewares/tenant.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.use(authenticate, tenantIsolation, requireRole("OWNER", "MANAGER"));

router.post("/query", asyncHandler(ai.query));
router.get("/history", asyncHandler(ai.getHistory));
router.delete("/history", requireRole("OWNER"), asyncHandler(ai.clearHistory));
router.get("/usage", asyncHandler(ai.getUsage));

export default router;
