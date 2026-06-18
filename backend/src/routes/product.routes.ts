import { Router } from "express";
import * as product from "../controllers/product.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/role.middleware";
import { tenantIsolation } from "../middlewares/tenant.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();
router.use(authenticate, tenantIsolation);

router.get("/", asyncHandler(product.listProducts));
router.post("/", requireRole("OWNER", "MANAGER"), asyncHandler(product.createProduct));
router.post("/bulk-import", requireRole("OWNER", "MANAGER"), asyncHandler(product.bulkImport));
router.get("/low-stock", asyncHandler(product.getLowStock));
router.get("/barcode/:code", asyncHandler(product.getProductByBarcode));
router.get("/:id", asyncHandler(product.getProduct));
router.patch("/:id", requireRole("OWNER", "MANAGER"), asyncHandler(product.updateProduct));
router.delete("/:id", requireRole("OWNER", "MANAGER"), asyncHandler(product.deleteProduct));

// Variations
router.get("/:id/variations", asyncHandler(product.listVariations));
router.post("/:id/variations", requireRole("OWNER", "MANAGER"), asyncHandler(product.createVariation));
router.patch("/:id/variations/:varId", requireRole("OWNER", "MANAGER"), asyncHandler(product.updateVariation));
router.delete("/:id/variations/:varId", requireRole("OWNER", "MANAGER"), asyncHandler(product.deleteVariation));

// Modifier group links
router.post("/:id/modifier-groups", requireRole("OWNER", "MANAGER"), asyncHandler(product.linkModifierGroup));
router.delete("/:id/modifier-groups/:groupId", requireRole("OWNER", "MANAGER"), asyncHandler(product.unlinkModifierGroup));

export default router;
