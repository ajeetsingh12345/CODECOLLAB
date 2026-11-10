import { Router } from "express";
import {
  register,
  login,
  refresh,
  logout,
  profile,
  updateProfile,
  startGoogleOAuth,
  finishGoogleOAuth
} from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/auth.js";
const router = Router();
router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.get("/google", startGoogleOAuth);
router.get("/google/callback", finishGoogleOAuth);
router.get("/me", authenticate, profile);
router.patch("/me", authenticate, updateProfile);
export default router;
