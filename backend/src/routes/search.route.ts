import { Router } from "express";
import { globalSearch } from "../controllers/search.controller";
import { requireAuth, requireOrganization } from "../middleware/auth.middleware";

const router = Router();

router.use(requireAuth);
router.use(requireOrganization);
router.get("/", globalSearch);

export default router;
