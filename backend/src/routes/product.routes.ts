import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/role.middleware";
import { tenantIsolation } from "../middlewares/tenant.middleware";
import { notImplemented } from "../utils/notImplemented";

const router = Router();

router.use(authenticate, tenantIsolation);

router.get("/", notImplemented);
router.post("/", requireRole("OWNER", "MANAGER"), notImplemented);
router.post("/bulk-import", requireRole("OWNER", "MANAGER"), notImplemented);
router.get("/export", requireRole("OWNER", "MANAGER"), notImplemented);
router.get("/low-stock", notImplemented);
router.get("/barcode/:code", notImplemented);
router.get("/:id", notImplemented);
router.patch("/:id", requireRole("OWNER", "MANAGER"), notImplemented);
router.delete("/:id", requireRole("OWNER", "MANAGER"), notImplemented);

export default router;
