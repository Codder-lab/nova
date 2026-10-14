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
import { browserManager } from "../tools/browser/browser.manager";

export const agentRouter = Router();

agentRouter.post("/run", optionalAuthMiddleware, runAgent);
agentRouter.post("/enqueue", optionalAuthMiddleware, enqueueJob);
agentRouter.get("/tools", listTools);
agentRouter.get("/runs", optionalAuthMiddleware, listRuns);
agentRouter.get("/runs/:runId", optionalAuthMiddleware, getRunById);

// Browser Session Management
agentRouter.post("/browser/close", async (req, res) => {
  try {
    const { sessionId } = req.body || {};
    if (sessionId) {
      await browserManager.closeSession(sessionId);
    } else {
      await browserManager.closeAll();
    }
    res.json({ success: true, message: "Browser session(s) closed successfully." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

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

