import { Router } from "express";
import {
  listMemories,
  createMemory,
  searchMemories,
  deleteMemory,
} from "../controllers/memory.controller";
import { optionalAuthMiddleware } from "../middleware/auth.middleware";

const router = Router();

router.use(optionalAuthMiddleware);

router.get("/", listMemories);
router.post("/", createMemory);
router.get("/search", searchMemories);
router.delete("/:id", deleteMemory);

export default router;
