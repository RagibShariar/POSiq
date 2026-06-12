import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/role.middleware";
import { tenantIsolation } from "../middlewares/tenant.middleware";
import { notImplemented } from "../utils/notImplemented";

const router = Router();

router.use(authenticate, tenantIsolation, requireRole("OWNER"));

router.get("/", notImplemented);
router.post("/upgrade", notImplemented);
router.post("/cancel", notImplemented);
router.get("/invoices", notImplemented);

export default router;
