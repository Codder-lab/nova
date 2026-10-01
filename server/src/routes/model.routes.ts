import { Router } from "express";
import {
  listModels,
  setActiveModel,
  updateModelConfig,
  testModelConnection,
  getModelMetrics,
} from "../controllers/model.controller";
import { optionalAuthMiddleware } from "../middleware/auth.middleware";

export const modelRouter = Router();

modelRouter.get("/", optionalAuthMiddleware, listModels);
modelRouter.post("/active", optionalAuthMiddleware, setActiveModel);
modelRouter.post("/config", optionalAuthMiddleware, updateModelConfig);
modelRouter.post("/test", optionalAuthMiddleware, testModelConnection);
modelRouter.get("/metrics", optionalAuthMiddleware, getModelMetrics);
