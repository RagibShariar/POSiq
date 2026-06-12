import { Router } from "express";
import * as inventory from "../controllers/inventory.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/role.middleware";
import { requireBranchAccess, tenantIsolation } from "../middlewares/tenant.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();
router.use(authenticate, tenantIsolation, requireRole("OWNER", "MANAGER"));

router.get("/logs", asyncHandler(inventory.listLogs));
router.get("/:branchId", requireBranchAccess(), asyncHandler(inventory.listInventory));
router.get("/:branchId/low-stock", requireBranchAccess(), asyncHandler(inventory.getLowStock));
router.post("/:branchId/restock", requireBranchAccess(), asyncHandler(inventory.restock));
router.get("/:branchId/:productId", requireBranchAccess(), asyncHandler(inventory.getInventoryItem));
router.patch("/:branchId/:productId", requireBranchAccess(), asyncHandler(inventory.adjustStock));

export default router;
