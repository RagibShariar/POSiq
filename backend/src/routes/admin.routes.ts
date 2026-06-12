import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/role.middleware";
import { notImplemented } from "../utils/notImplemented";

const router = Router();

// SUPER_ADMIN only — requireRole with no allowed roles still lets SUPER_ADMIN through
router.use(authenticate, requireRole());

router.get("/businesses", notImplemented);
router.get("/businesses/:id", notImplemented);
router.patch("/businesses/:id", notImplemented);
router.post("/businesses/:id/suspend", notImplemented);
router.get("/stats", notImplemented);
router.get("/ai-usage", notImplemented);
router.post("/impersonate/:id", notImplemented);

export default router;
