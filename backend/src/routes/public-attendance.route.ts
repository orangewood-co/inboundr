import { Router } from "express";
import {
  createPublicAttendanceSelfiePresign,
  getPublicAttendanceWorkspace,
  identifyPublicAttendanceEmployee,
  markPublicAttendance,
} from "../controllers/attendance.controller";
import { publicReadLimiter, publicWriteLimiter } from "../middleware/rate-limit.middleware";

const router = Router();

router.get("/:organizationId", publicReadLimiter, getPublicAttendanceWorkspace);
router.post("/:organizationId/identify", publicWriteLimiter, identifyPublicAttendanceEmployee);
router.post("/:organizationId/selfie/presign", publicWriteLimiter, createPublicAttendanceSelfiePresign);
router.post("/:organizationId/mark", publicWriteLimiter, markPublicAttendance);

export default router;
