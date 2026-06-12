import { Router } from "express";
import * as report from "../controllers/report.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/role.middleware";
import { tenantIsolation } from "../middlewares/tenant.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.use(authenticate, tenantIsolation, requireRole("OWNER", "MANAGER"));

router.get("/summary", asyncHandler(report.summary));
router.get("/sales", asyncHandler(report.sales));
router.get("/products", asyncHandler(report.products));
router.get("/cashiers", asyncHandler(report.cashiers));
router.get("/inventory", asyncHandler(report.inventory));
router.get("/branches", requireRole("OWNER"), asyncHandler(report.branches));

export default router;
