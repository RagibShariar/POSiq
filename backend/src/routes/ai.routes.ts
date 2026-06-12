import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/role.middleware";
import { tenantIsolation } from "../middlewares/tenant.middleware";
import { notImplemented } from "../utils/notImplemented";

const router = Router();

router.use(authenticate, tenantIsolation, requireRole("OWNER", "MANAGER"));

router.post("/query", notImplemented);
router.get("/history", notImplemented);
router.delete("/history", notImplemented);
router.get("/usage", notImplemented);

export default router;
