import { Router } from "express";
import {
  createManualAttendance,
  exportAttendanceCsv,
  listAttendance,
  updateAttendance,
} from "../controllers/attendance.controller";
import {
  requireAuth,
  requireEmployeeModule,
  requireOrganization,
  requireOrganizationRole,
} from "../middleware/auth.middleware";

const router = Router();

router.use(requireAuth);
router.use(requireOrganization);
router.use(requireEmployeeModule("employees"));

router.get("/", listAttendance);
router.get("/export", exportAttendanceCsv);
router.post("/manual", requireOrganizationRole(["owner", "admin"]), createManualAttendance);
router.patch("/:id", requireOrganizationRole(["owner", "admin"]), updateAttendance);

export default router;
