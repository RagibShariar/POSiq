import { Router } from "express";
import adminRoutes from "./admin.routes";
import aiRoutes from "./ai.routes";
import authRoutes from "./auth.routes";
import branchRoutes from "./branch.routes";
import businessRoutes from "./business.routes";
import categoryRoutes from "./category.routes";
import inventoryRoutes from "./inventory.routes";
import modifierRoutes from "./modifier.routes";
import orderRoutes from "./order.routes";
import productRoutes from "./product.routes";
import registerRoutes from "./register.routes";
import reportRoutes from "./report.routes";
import settingsRoutes from "./settings.routes";
import subscriptionRoutes from "./subscription.routes";
import userRoutes from "./user.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/business", businessRoutes);
router.use("/branches", branchRoutes);
router.use("/users", userRoutes);
router.use("/categories", categoryRoutes);
router.use("/products", productRoutes);
router.use("/modifier-groups", modifierRoutes);
router.use("/inventory", inventoryRoutes);
router.use("/registers", registerRoutes);
router.use("/orders", orderRoutes);
router.use("/reports", reportRoutes);
router.use("/ai", aiRoutes);
router.use("/settings", settingsRoutes);
router.use("/subscription", subscriptionRoutes);
router.use("/admin", adminRoutes);

export default router;
