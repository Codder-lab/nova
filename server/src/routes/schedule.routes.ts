import { Router } from "express";
import {
  listSchedules,
  createSchedule,
  toggleSchedule,
  deleteSchedule,
} from "../controllers/schedule.controller";
import { optionalAuthMiddleware } from "../middleware/auth.middleware";

const router = Router();

router.use(optionalAuthMiddleware);

router.get("/", listSchedules);
router.post("/", createSchedule);
router.patch("/:id/toggle", toggleSchedule);
router.delete("/:id", deleteSchedule);

export default router;
