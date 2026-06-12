import { Router } from "express";
import * as user from "../controllers/user.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/role.middleware";
import { tenantIsolation } from "../middlewares/tenant.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.use(authenticate, tenantIsolation);

router.get("/me", asyncHandler(user.getMe));
router.patch("/me", asyncHandler(user.updateMe));
router.get("/", requireRole("OWNER", "MANAGER"), asyncHandler(user.listUsers));
router.post("/invite", requireRole("OWNER"), asyncHandler(user.inviteUser));
router.get("/:id", requireRole("OWNER", "MANAGER"), asyncHandler(user.getUser));
router.patch("/:id", requireRole("OWNER"), asyncHandler(user.updateUser));
router.delete("/:id", requireRole("OWNER"), asyncHandler(user.deactivateUser));
router.patch("/:id/activate", requireRole("OWNER"), asyncHandler(user.reactivateUser));

export default router;
