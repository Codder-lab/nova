import { Request, Response } from "express";
import { AgentRunModel } from "../models/agent-run.model";

export async function listRuns(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId || "anonymous";
    const { status, limit } = req.query;

    const query: Record<string, unknown> = { userId };
    if (status && status !== "all") {
      query.status = status;
    }

    const runs = await AgentRunModel.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit) || 30);

    res.json({
      success: true,
      count: runs.length,
      runs: runs.map((r) => r.toJSON()),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function getRunById(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId || "anonymous";
    const run = await AgentRunModel.findOne({
      runId: req.params.runId,
      userId,
    });

    if (!run) {
      res.status(404).json({ success: false, error: "Agent run not found" });
      return;
    }

    res.json({
      success: true,
      run: run.toJSON(),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}
