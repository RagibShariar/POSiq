import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import { requireBranchAccess, tenantIsolation } from "../middlewares/tenant.middleware";
import { notImplemented } from "../utils/notImplemented";

const router = Router();

router.use(authenticate, tenantIsolation);

router.get("/:branchId", requireBranchAccess(), notImplemented);
router.post("/:branchId/open", requireBranchAccess(), notImplemented);
router.post("/:branchId/close", requireBranchAccess(), notImplemented);
router.get("/:branchId/history", requireBranchAccess(), notImplemented);

export default router;
