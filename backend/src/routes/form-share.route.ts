import { Router } from "express";
import { getFormSharePage } from "../controllers/og.controller";

const router = Router();

router.get("/:slug", getFormSharePage);

export default router;
