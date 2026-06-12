import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/role.middleware";
import { tenantIsolation } from "../middlewares/tenant.middleware";
import { notImplemented } from "../utils/notImplemented";

const router = Router();

router.use(authenticate, tenantIsolation, requireRole("OWNER", "MANAGER"));

router.get("/summary", notImplemented);
router.get("/sales", notImplemented);
router.get("/products", notImplemented);
router.get("/cashiers", notImplemented);
router.get("/inventory", notImplemented);
router.get("/branches", requireRole("OWNER"), notImplemented);

export default router;
