import { Router } from "express";
import {
  createProduct,
  deleteProduct,
  getProduct,
  getProductFacets,
  getProductStats,
  importProducts,
  listProductDuplicates,
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
import {
  getProductSettings,
  updateProductSettings,
} from "../controllers/product-settings.controller";

const router = Router();

router.use(requireAuth);
router.use(requireOrganization);
router.use(requireFeature("products"));
router.use(requireEmployeeModule("products"));
router.get("/", listProducts);
router.get("/stats", getProductStats);
router.get("/facets", getProductFacets);
router.get("/matches", listProductMatches);
router.get("/duplicates", listProductDuplicates);
router.get("/settings", getProductSettings);
router.put("/settings", requireOrganizationAdmin(), updateProductSettings);
router.post("/import", requireOrganizationAdmin(), importProducts);
router.get("/:id", getProduct);
router.post("/", requireOrganizationAdmin(), createProduct);
router.put("/:id", requireOrganizationAdmin(), updateProduct);
router.delete("/:id", requireOrganizationAdmin(), deleteProduct);

export default router;
