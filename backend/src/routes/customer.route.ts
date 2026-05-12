import { Router } from "express";
import { createCustomer, listCustomers, updateCustomer } from "../controllers/customer.controller";
import { requireAuth, requireOrganization } from "../middleware/auth.middleware";

const router = Router();

router.use(requireAuth);
router.use(requireOrganization);
router.get("/", listCustomers);
router.post("/", createCustomer);
router.put("/:id", updateCustomer);

export default router;
