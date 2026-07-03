import { Router } from "express";
import { getFormOgImage } from "../controllers/og.controller";

const router = Router();

router.get("/forms/:slug.png", getFormOgImage);

export default router;
