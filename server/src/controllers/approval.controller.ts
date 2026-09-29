import { Request, Response } from "express";
import { AgentEngine } from "../agents/agent.engine";
import { AgentRunModel } from "../models/agent-run.model";

let engineFactory: () => AgentEngine = () => new AgentEngine();

export function setApprovalEngineFactory(factory: () => AgentEngine): void {
  engineFactory = factory;
}

export async function approveAction(
  req: Request,
  res: Response,
): Promise<void> {
  const { runId } = req.params;

  try {
    const engine = engineFactory();
    const result = await engine.resume(runId, true);

    res.json({
      success: true,
      message: "Action authorized and execution resumed successfully.",
      result,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
}

export async function rejectAction(req: Request, res: Response): Promise<void> {
  const { runId } = req.params;

  try {
    const engine = engineFactory();
    const result = await engine.resume(runId, false);

    res.json({
      success: true,
      message: "Action rejected by user.",
      result,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
}

export async function getPendingApproval(
  req: Request,
  res: Response,
): Promise<void> {
  const { runId } = req.params;

  try {
    const run = await AgentRunModel.findOne({ runId });
    if (!run) {
      res.status(404).json({ success: false, error: "Run not found" });
      return;
    }

    if (run.status !== "waiting_for_approval" || !run.pendingApproval) {
      res.json({
        success: true,
        waiting: false,
        message: `Run "${runId}" is not waiting for approval. Status is "${run.status}".`,
      });
      return;
    }

    res.json({
      success: true,
      waiting: true,
      pendingApproval: run.pendingApproval,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}
