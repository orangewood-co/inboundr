import { Router } from "express";
import {
  createProduct,
  getProduct,
  listProducts,
  updateProduct,
} from "../controllers/products.controller";

const router = Router();

router.get("/", listProducts);
router.get("/:id", getProduct);
router.post("/", createProduct);
router.put("/:id", updateProduct);

export default router;
