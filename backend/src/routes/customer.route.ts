import { Router } from "express";
import {
  archiveCustomer,
  createCustomer,
  exportCustomers,
  getCustomer,
  getCustomerSettings,
  importCustomers,
  listCustomers,
  updateCustomer,
  updateCustomerSettings,
} from "../controllers/customer.controller";
import { requireAuth, requireEmployeeModule, requireFeature, requireOrganization, requireOrganizationAdmin } from "../middleware/auth.middleware";

const router = Router();

router.use(requireAuth);
router.use(requireOrganization);
router.use(requireFeature("customers"));
router.use(requireEmployeeModule("customers"));
router.get("/", listCustomers);
router.get("/export", exportCustomers);
router.post("/import", requireOrganizationAdmin(), importCustomers);
router.get("/settings", getCustomerSettings);
router.put("/settings", requireOrganizationAdmin(), updateCustomerSettings);
router.get("/:id", getCustomer);
router.post("/", createCustomer);
router.put("/:id", updateCustomer);
router.patch("/:id/archive", archiveCustomer);

export default router;
