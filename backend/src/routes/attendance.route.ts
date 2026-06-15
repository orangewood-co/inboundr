import { Router } from "express";
import {
  createManualAttendance,
  listAttendance,
  listAttendanceRange,
  updateAttendance,
} from "../controllers/attendance.controller";
import {
  requireAuth,
  requireEmployeeModule,
  requireFeature,
  requireOrganization,
  requireOrganizationRole,
} from "../middleware/auth.middleware";

const router = Router();

router.use(requireAuth);
router.use(requireOrganization);
router.use(requireFeature("employees"));
router.use(requireEmployeeModule("employees"));

router.get("/", listAttendance);
router.get("/range", listAttendanceRange);
router.post("/manual", requireOrganizationRole(["owner", "admin"]), createManualAttendance);
router.patch("/:id", requireOrganizationRole(["owner", "admin"]), updateAttendance);

export default router;
