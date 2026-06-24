import { Router } from "express";
import {
  createProduct,
  getProduct,
  getProductStats,
  importProducts,
  listProductMatches,
  listProducts,
  updateProduct,
} from "../controllers/products.controller";
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
router.use(requireFeature("products"));
router.use(requireEmployeeModule("products"));
router.get("/", listProducts);
router.get("/stats", getProductStats);
router.get("/matches", listProductMatches);
router.post("/import", requireOrganizationAdmin(), importProducts);
router.get("/:id", getProduct);
router.post("/", requireOrganizationAdmin(), createProduct);
router.put("/:id", requireOrganizationAdmin(), updateProduct);

export default router;
