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
  requireOrganizationAdmin,
} from "../middleware/auth.middleware";

const router = Router();

router.use(requireAuth);
router.use(requireOrganization);
router.use(requireFeature("employees"));
router.use(requireEmployeeModule("employees"));

router.get("/", listAttendance);
router.get("/range", listAttendanceRange);
router.post("/manual", requireOrganizationAdmin(), createManualAttendance);
router.patch("/:id", requireOrganizationAdmin(), updateAttendance);

export default router;
