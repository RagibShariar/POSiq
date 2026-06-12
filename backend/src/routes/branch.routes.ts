import { Router } from "express";
import * as branch from "../controllers/branch.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/role.middleware";
import { tenantIsolation } from "../middlewares/tenant.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.use(authenticate, tenantIsolation);

router.get("/", requireRole("OWNER", "MANAGER"), asyncHandler(branch.listBranches));
router.post("/", requireRole("OWNER"), asyncHandler(branch.createBranch));
router.get("/:id", requireRole("OWNER", "MANAGER"), asyncHandler(branch.getBranch));
router.patch("/:id", requireRole("OWNER"), asyncHandler(branch.updateBranch));
router.delete("/:id", requireRole("OWNER"), asyncHandler(branch.deleteBranch));
router.get("/:id/staff", requireRole("OWNER", "MANAGER"), asyncHandler(branch.listStaff));
router.post("/:id/staff", requireRole("OWNER"), asyncHandler(branch.assignStaff));
router.delete("/:id/staff/:userId", requireRole("OWNER"), asyncHandler(branch.unassignStaff));

export default router;
