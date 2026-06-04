import { Router } from "express";
import {
  createPublicAttendanceSelfiePresign,
  getPublicAttendanceWorkspace,
  identifyPublicAttendanceEmployee,
  markPublicAttendance,
} from "../controllers/attendance.controller";

const router = Router();

router.get("/:organizationId", getPublicAttendanceWorkspace);
router.post("/:organizationId/identify", identifyPublicAttendanceEmployee);
router.post("/:organizationId/selfie/presign", createPublicAttendanceSelfiePresign);
router.post("/:organizationId/mark", markPublicAttendance);

export default router;
