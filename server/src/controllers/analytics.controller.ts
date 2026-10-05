import { Request, Response } from "express";
import { AnalyticsTimeRange } from "@nova/shared";
import { analyticsService } from "../services/analytics.service";
import { logger } from "../utils/logger";

function parseTimeRange(req: Request): AnalyticsTimeRange {
  const range = (req.query.range as string) || "7d";
  if (["24h", "7d", "30d", "all"].includes(range)) {
    return range as AnalyticsTimeRange;
  }
  return "7d";
}

export async function getOverview(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId || (req.query.userId as string) || undefined;
    const timeRange = parseTimeRange(req);
    const overview = await analyticsService.getOverview(userId, timeRange);
    res.json({ success: true, overview });
  } catch (err: any) {
    logger.error({ err }, "Failed to get analytics overview");
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function getTimeline(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId || (req.query.userId as string) || undefined;
    const timeRange = parseTimeRange(req);
    const timeline = await analyticsService.getTimeline(userId, timeRange);
    res.json({ success: true, timeline });
  } catch (err: any) {
    logger.error({ err }, "Failed to get analytics timeline");
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function getModels(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId || (req.query.userId as string) || undefined;
    const timeRange = parseTimeRange(req);
    const models = await analyticsService.getModelStats(userId, timeRange);
    res.json({ success: true, models });
  } catch (err: any) {
    logger.error({ err }, "Failed to get model stats");
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function getTools(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId || (req.query.userId as string) || undefined;
    const timeRange = parseTimeRange(req);
    const tools = await analyticsService.getToolStats(userId, timeRange);
    res.json({ success: true, tools });
  } catch (err: any) {
    logger.error({ err }, "Failed to get tool stats");
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function getComplexity(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId || (req.query.userId as string) || undefined;
    const timeRange = parseTimeRange(req);
    const complexity = await analyticsService.getComplexitySummary(
      userId,
      timeRange
    );
    res.json({ success: true, complexity });
  } catch (err: any) {
    logger.error({ err }, "Failed to get complexity stats");
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function getFullReport(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId || (req.query.userId as string) || undefined;
    const timeRange = parseTimeRange(req);
    const report = await analyticsService.getFullReport(userId, timeRange);
    res.json({ success: true, report });
  } catch (err: any) {
    logger.error({ err }, "Failed to get full analytics report");
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function exportCsv(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId || (req.query.userId as string) || undefined;
    const timeRange = parseTimeRange(req);
    const csv = await analyticsService.exportReportCsv(userId, timeRange);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=nova-analytics-${timeRange}-${Date.now()}.csv`
    );
    res.send(csv);
  } catch (err: any) {
    logger.error({ err }, "Failed to export analytics CSV");
    res.status(500).json({ success: false, error: err.message });
  }
}
