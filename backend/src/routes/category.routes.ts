import { Router } from "express";
import * as category from "../controllers/category.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/role.middleware";
import { tenantIsolation } from "../middlewares/tenant.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();
router.use(authenticate, tenantIsolation);

router.get("/", asyncHandler(category.listCategories));
router.post("/", requireRole("OWNER", "MANAGER"), asyncHandler(category.createCategory));
router.get("/:id", asyncHandler(category.getCategory));
router.patch("/:id", requireRole("OWNER", "MANAGER"), asyncHandler(category.updateCategory));
router.delete("/:id", requireRole("OWNER", "MANAGER"), asyncHandler(category.deleteCategory));

export default router;
