import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { activities, notifications, markNotificationRead } from "../controllers/misc.controller.js";
const router = Router();
router.get("/activities", authenticate, activities);
router.get("/notifications", authenticate, notifications);
router.patch("/notifications/:id/read", authenticate, markNotificationRead);
export default router;
