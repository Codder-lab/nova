import { Router } from "express";
import {
  runAgent,
  enqueueJob,
  listTools,
} from "../controllers/agent.controller";
import { listRuns, getRunById } from "../controllers/run.controller";
import {
  approveAction,
  rejectAction,
  getPendingApproval,
} from "../controllers/approval.controller";
import { optionalAuthMiddleware } from "../middleware/auth.middleware";

export const agentRouter = Router();

agentRouter.post("/run", optionalAuthMiddleware, runAgent);
agentRouter.post("/enqueue", optionalAuthMiddleware, enqueueJob);
agentRouter.get("/tools", listTools);
agentRouter.get("/runs", optionalAuthMiddleware, listRuns);
agentRouter.get("/runs/:runId", optionalAuthMiddleware, getRunById);

// Human-in-the-loop Approval Endpoints
agentRouter.get(
  "/runs/:runId/pending-approval",
  optionalAuthMiddleware,
  getPendingApproval,
);
agentRouter.get(
  "/:runId/pending-approval",
  optionalAuthMiddleware,
  getPendingApproval,
);
agentRouter.post("/runs/:runId/approve", optionalAuthMiddleware, approveAction);
agentRouter.post("/:runId/approve", optionalAuthMiddleware, approveAction);
agentRouter.post("/runs/:runId/reject", optionalAuthMiddleware, rejectAction);
agentRouter.post("/:runId/reject", optionalAuthMiddleware, rejectAction);
