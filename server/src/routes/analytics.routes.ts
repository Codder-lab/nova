import { Router } from "express";
import {
  getOverview,
  getTimeline,
  getModels,
  getTools,
  getComplexity,
  getFullReport,
  exportCsv,
} from "../controllers/analytics.controller";
import { optionalAuthMiddleware } from "../middleware/auth.middleware";

const router = Router();

router.use(optionalAuthMiddleware);

router.get("/overview", getOverview);
router.get("/timeline", getTimeline);
router.get("/models", getModels);
router.get("/tools", getTools);
router.get("/complexity", getComplexity);
router.get("/report", getFullReport);
router.get("/export", exportCsv);

export default router;
