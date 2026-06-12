import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/role.middleware";
import { requireBranchAccess, tenantIsolation } from "../middlewares/tenant.middleware";
import { notImplemented } from "../utils/notImplemented";

const router = Router();

router.use(authenticate, tenantIsolation, requireRole("OWNER", "MANAGER"));

router.get("/", notImplemented);
router.get("/logs", notImplemented);
router.get("/:branchId", requireBranchAccess(), notImplemented);
router.get("/:branchId/low-stock", requireBranchAccess(), notImplemented);
router.post("/:branchId/restock", requireBranchAccess(), notImplemented);
router.get("/:branchId/:productId", requireBranchAccess(), notImplemented);
router.patch("/:branchId/:productId", requireBranchAccess(), notImplemented);

export default router;
