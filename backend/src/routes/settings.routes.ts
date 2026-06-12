import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/role.middleware";
import { tenantIsolation } from "../middlewares/tenant.middleware";
import { notImplemented } from "../utils/notImplemented";

const router = Router();

router.use(authenticate, tenantIsolation, requireRole("OWNER", "MANAGER"));

router.get("/", notImplemented);
router.patch("/", requireRole("OWNER"), notImplemented);
router.get("/receipt", notImplemented);
router.patch("/receipt", requireRole("OWNER"), notImplemented);

export default router;
