import { Request, Response } from "express";
import { z } from "zod";
import { schedulerService } from "../services/scheduler.service";

const createScheduleSchema = z.object({
  prompt: z.string().min(1, "Prompt is required"),
  schedule: z.string().min(1, "Schedule expression is required"),
  timezone: z.string().optional().default("UTC"),
});

const toggleScheduleSchema = z.object({
  enabled: z.boolean(),
});

export async function listSchedules(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const userId = req.user?.userId || "anonymous";
    const enabledOnly = req.query.enabledOnly === "true";

    const schedules = await schedulerService.listSchedules(userId, enabledOnly);
    res.json({
      success: true,
      count: schedules.length,
      schedules: schedules.map((s) => s.toJSON()),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function createSchedule(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const parsed = createScheduleSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, errors: parsed.error.errors });
      return;
    }

    const userId = req.user?.userId || "anonymous";
    const schedule = await schedulerService.createSchedule({
      userId,
      ...parsed.data,
    });

    res.status(201).json({
      success: true,
      message: "Scheduled automation created successfully",
      schedule: schedule.toJSON(),
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
}

export async function toggleSchedule(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const parsed = toggleScheduleSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, errors: parsed.error.errors });
      return;
    }

    const userId = req.user?.userId || "anonymous";
    const updated = await schedulerService.toggleSchedule(
      userId,
      req.params.id,
      parsed.data.enabled,
    );

    if (!updated) {
      res.status(404).json({ success: false, error: "Schedule not found" });
      return;
    }

    res.json({
      success: true,
      message: `Schedule ${parsed.data.enabled ? "enabled" : "disabled"} successfully`,
      schedule: updated.toJSON(),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function deleteSchedule(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const userId = req.user?.userId || "anonymous";
    const deleted = await schedulerService.deleteSchedule(
      userId,
      req.params.id,
    );

    if (!deleted) {
      res.status(404).json({ success: false, error: "Schedule not found" });
      return;
    }

    res.json({
      success: true,
      message: "Schedule deleted successfully",
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}
