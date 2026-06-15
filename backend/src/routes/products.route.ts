import { Router } from "express";
import {
  createProduct,
  getProduct,
  getProductStats,
  importProducts,
  listProducts,
  updateProduct,
} from "../controllers/products.controller";
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
router.use(requireFeature("products"));
router.use(requireEmployeeModule("products"));
router.get("/", listProducts);
router.get("/stats", getProductStats);
router.post("/import", requireOrganizationRole(["owner", "admin"]), importProducts);
router.get("/:id", getProduct);
router.post("/", requireOrganizationRole(["owner", "admin"]), createProduct);
router.put("/:id", requireOrganizationRole(["owner", "admin"]), updateProduct);

export default router;
