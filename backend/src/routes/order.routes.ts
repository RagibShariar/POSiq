import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/role.middleware";
import { tenantIsolation } from "../middlewares/tenant.middleware";
import { notImplemented } from "../utils/notImplemented";

const router = Router();

router.use(authenticate, tenantIsolation);

router.get("/", notImplemented);
router.post("/", notImplemented);
router.get("/refunds", requireRole("OWNER", "MANAGER"), notImplemented);
router.get("/:id", notImplemented);
router.patch("/:id/void", requireRole("OWNER", "MANAGER"), notImplemented);
router.get("/:id/receipt", notImplemented);
router.post("/:id/receipt/print", notImplemented);
router.post("/:id/refund", requireRole("OWNER", "MANAGER"), notImplemented);

export default router;
