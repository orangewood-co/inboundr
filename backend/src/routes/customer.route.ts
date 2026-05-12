import { Router } from "express";
import { listCustomers, updateCustomer } from "../controllers/customer.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.use(requireAuth);
router.get("/", listCustomers);
router.put("/:id", updateCustomer);

export default router;
