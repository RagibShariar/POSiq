import { Router } from "express";
import * as register from "../controllers/register.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { requireBranchAccess, tenantIsolation } from "../middlewares/tenant.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();
router.use(authenticate, tenantIsolation);

router.get("/:branchId", requireBranchAccess(), asyncHandler(register.getRegister));
router.post("/:branchId/open", requireBranchAccess(), asyncHandler(register.openRegister));
router.post("/:branchId/close", requireBranchAccess(), asyncHandler(register.closeRegister));
router.get("/:branchId/history", requireBranchAccess(), asyncHandler(register.getHistory));

export default router;
