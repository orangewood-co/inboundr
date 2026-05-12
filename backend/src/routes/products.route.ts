import { Router } from "express";
import {
  createProduct,
  getProduct,
  listProducts,
  updateProduct,
} from "../controllers/products.controller";
import { requireAuth, requireOrganization } from "../middleware/auth.middleware";

const router = Router();

router.use(requireAuth);
router.use(requireOrganization);
router.get("/", listProducts);
router.get("/:id", getProduct);
router.post("/", createProduct);
router.put("/:id", updateProduct);

export default router;
