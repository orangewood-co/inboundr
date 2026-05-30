import { Router } from "express";
import {
  archiveCustomer,
  createCustomer,
  exportCustomers,
  getCustomer,
  importCustomers,
  listCustomers,
  updateCustomer,
} from "../controllers/customer.controller";
import { requireAuth, requireEmployeeModule, requireOrganization, requireOrganizationRole } from "../middleware/auth.middleware";

const router = Router();

router.use(requireAuth);
router.use(requireOrganization);
router.use(requireEmployeeModule("customers"));
router.get("/", listCustomers);
router.get("/export", exportCustomers);
router.post("/import", requireOrganizationRole(["owner", "admin"]), importCustomers);
router.get("/:id", getCustomer);
router.post("/", createCustomer);
router.put("/:id", updateCustomer);
router.patch("/:id/archive", archiveCustomer);

export default router;
