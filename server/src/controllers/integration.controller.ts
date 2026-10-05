import { Request, Response } from "express";
import { z } from "zod";
import { integrationService } from "../services/integration.service";
import { logger } from "../utils/logger";

const saveIntegrationSchema = z.object({
  connectorId: z.string().min(1, "connectorId is required"),
  credentials: z.record(z.string()).default({}),
  enabled: z.boolean().optional().default(true),
  name: z.string().optional(),
  customConfig: z
    .object({
      baseUrl: z.string().min(1, "baseUrl is required"),
      authHeaderKey: z.string().optional(),
      authPrefix: z.string().optional(),
      actions: z
        .array(
          z.object({
            name: z.string().min(1),
            description: z.string().min(1),
            method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]),
            path: z.string().min(1),
            riskLevel: z.enum(["low", "medium", "high"]).default("low"),
            parameters: z
              .array(
                z.object({
                  name: z.string(),
                  type: z.enum(["string", "number", "boolean"]),
                  required: z.boolean(),
                  description: z.string(),
                })
              )
              .default([]),
          })
        )
        .default([]),
    })
    .optional(),
});

const testIntegrationSchema = z.object({
  connectorId: z.string().min(1, "connectorId is required"),
  credentials: z.record(z.string()).optional(),
  customConfig: z.any().optional(),
});

function getUserId(req: Request): string {
  return (
    req.user?.userId ||
    (req.headers["x-user-id"] as string) ||
    (req.query.userId as string) ||
    "cli-user"
  );
}

export async function getConnectors(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const connectors = integrationService.getAvailableConnectors();
    res.json({ success: true, connectors });
  } catch (err: any) {
    logger.error({ err }, "Failed to get available connectors");
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function getUserIntegrations(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const userId = getUserId(req);
    const integrations = await integrationService.getUserIntegrations(userId);
    res.json({ success: true, integrations });
  } catch (err: any) {
    logger.error({ err }, "Failed to fetch user integrations");
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function saveIntegration(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const userId = getUserId(req);
    const parsed = saveIntegrationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: "Invalid request payload",
        details: parsed.error.format(),
      });
      return;
    }

    const integration = await integrationService.saveUserIntegration(
      userId,
      parsed.data
    );
    res.json({ success: true, integration });
  } catch (err: any) {
    logger.error({ err }, "Failed to save user integration");
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function testIntegration(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const userId = getUserId(req);
    const parsed = testIntegrationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: "Invalid test request payload",
        details: parsed.error.format(),
      });
      return;
    }

    const result = await integrationService.testIntegration(userId, parsed.data);
    res.json(result);
  } catch (err: any) {
    logger.error({ err }, "Failed to test integration");
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function toggleIntegration(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const userId = getUserId(req);
    const { connectorId } = req.params;
    const { enabled } = req.body;

    if (typeof enabled !== "boolean") {
      res.status(400).json({ success: false, error: "'enabled' boolean is required" });
      return;
    }

    const updated = await integrationService.toggleIntegration(
      userId,
      connectorId,
      enabled
    );
    if (!updated) {
      res.status(404).json({ success: false, error: "Integration not found" });
      return;
    }

    res.json({ success: true, integration: updated });
  } catch (err: any) {
    logger.error({ err }, "Failed to toggle integration");
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function deleteIntegration(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const userId = getUserId(req);
    const { connectorId } = req.params;

    const deleted = await integrationService.deleteUserIntegration(
      userId,
      connectorId
    );
    res.json({ success: true, deleted });
  } catch (err: any) {
    logger.error({ err }, "Failed to delete integration");
    res.status(500).json({ success: false, error: err.message });
  }
}
