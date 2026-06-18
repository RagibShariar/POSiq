import { Router } from "express";
import * as modifier from "../controllers/modifier.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/role.middleware";
import { tenantIsolation } from "../middlewares/tenant.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();
router.use(authenticate, tenantIsolation);

router.get("/", asyncHandler(modifier.listGroups));
router.post("/", requireRole("OWNER", "MANAGER"), asyncHandler(modifier.createGroup));
router.patch("/:id", requireRole("OWNER", "MANAGER"), asyncHandler(modifier.updateGroup));
router.delete("/:id", requireRole("OWNER", "MANAGER"), asyncHandler(modifier.deleteGroup));

router.post("/:id/items", requireRole("OWNER", "MANAGER"), asyncHandler(modifier.addItem));
router.patch("/:id/items/:itemId", requireRole("OWNER", "MANAGER"), asyncHandler(modifier.updateItem));
router.delete("/:id/items/:itemId", requireRole("OWNER", "MANAGER"), asyncHandler(modifier.deleteItem));

export default router;
