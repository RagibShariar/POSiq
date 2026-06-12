import { Router } from "express";
import * as auth from "../controllers/auth.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.post("/register", asyncHandler(auth.register));
router.post("/login", asyncHandler(auth.login));
router.post("/logout", authenticate, asyncHandler(auth.logout));
router.post("/refresh", asyncHandler(auth.refresh));
router.post("/forgot-password", asyncHandler(auth.forgotPassword));
router.post("/reset-password", asyncHandler(auth.resetPassword));
router.patch("/change-password", authenticate, asyncHandler(auth.changePassword));

export default router;
