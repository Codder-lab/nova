import {
  ConnectorMeta,
  SaveIntegrationRequest,
  TestIntegrationRequest,
  TestIntegrationResponse,
  UserIntegration,
} from "@nova/shared";
import { IntegrationModel, IIntegration } from "../models/integration.model";
import { connectorRegistry } from "../integrations/connector.registry";
import { encryptionService } from "./encryption.service";
import { AgentTool } from "../tools/base/agent-tool.interface";
import { logger } from "../utils/logger";
import { whatsappService } from "./whatsapp.service";

const GUEST_USER_IDS = ["cli-user", "anonymous-user", "anonymous"];

function resolveUserFilter(userId: string) {
  if (GUEST_USER_IDS.includes(userId)) {
    return { $in: GUEST_USER_IDS };
  }
  return userId;
}

export class IntegrationService {
  /**
   * Returns metadata for all registered built-in connectors
   */
  public getAvailableConnectors(): ConnectorMeta[] {
    return connectorRegistry.getMetadataList();
  }

  /**
   * Lists all integrations configured by a given user
   */
  public async getUserIntegrations(userId: string): Promise<UserIntegration[]> {
    const targetUserId = userId || "cli-user";
    const docs = await IntegrationModel.find({
      userId: resolveUserFilter(targetUserId),
    }).sort({ updatedAt: -1 });

    const userIntegrations = docs.map((doc) => this.mapDocumentToUserIntegration(doc));

    // Dynamic sync with live WhatsAppService connection state
    const waStatus = whatsappService.getStatus();
    const existingWa = userIntegrations.find((i) => i.connectorId === "whatsapp");

    if (waStatus.isConnected) {
      const phone = waStatus.user?.phone;
      if (existingWa) {
        existingWa.status = "connected";
        existingWa.errorMessage = undefined;
        if (phone) {
          existingWa.maskedCredentials = {
            ...existingWa.maskedCredentials,
            defaultRecipient: phone,
          };
        }
      } else {
        const liveWa: UserIntegration = {
          id: `wa-${targetUserId}`,
          userId: targetUserId,
          connectorId: "whatsapp",
          name: "WhatsApp",
          category: "communication",
          enabled: true,
          status: "connected",
          lastTestedAt: waStatus.lastActive?.toISOString() || new Date().toISOString(),
          maskedCredentials: phone ? { defaultRecipient: phone } : {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        userIntegrations.push(liveWa);

        // Background sync to DB
        whatsappService.syncToIntegrationModel(targetUserId).catch(() => {});
      }
    } else if (existingWa && existingWa.status === "connected") {
      existingWa.status = "unconfigured";
    }

    return userIntegrations;
  }

  /**
   * Saves or updates a user's integration credentials and configuration
   */
  public async saveUserIntegration(
    userId: string,
    payload: SaveIntegrationRequest
  ): Promise<UserIntegration> {
    const { connectorId, credentials, enabled = true, name, customConfig } = payload;

    const connector = connectorRegistry.get(connectorId);
    const isCustom = !connector || connector.isCustom;

    const integrationName =
      name || (connector ? connector.name : "Custom Integration");
    const category = connector ? connector.category : "custom";

    // Encrypt credentials
    const encryptedCredentials = encryptionService.encryptObject(credentials || {});

    // Create masked map
    const maskedCredentials: Record<string, string> = {};
    for (const [key, value] of Object.entries(credentials || {})) {
      maskedCredentials[key] = encryptionService.mask(value);
    }

    // Auto-test on save
    let status: "connected" | "error" | "unconfigured" = "connected";
    let errorMessage: string | undefined;

    try {
      const targetConnector = connector || connectorRegistry.get("custom_rest")!;
      const testResult = await targetConnector.testConnection(
        credentials || {},
        customConfig
      );
      if (!testResult.success) {
        status = "error";
        errorMessage = testResult.message;
      }
    } catch (err: any) {
      status = "error";
      errorMessage = err.message || "Failed to verify connection";
    }

    const doc = await IntegrationModel.findOneAndUpdate(
      { userId: resolveUserFilter(userId), connectorId },
      {
        userId,
        connectorId,
        name: integrationName,
        category,
        enabled,
        status,
        lastTestedAt: new Date(),
        errorMessage,
        encryptedCredentials,
        maskedCredentials,
        customConfig,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    logger.info(
      { userId, connectorId, status },
      "Saved integration credentials and tested connection"
    );

    return this.mapDocumentToUserIntegration(doc);
  }

  /**
   * Removes an integration configuration
   */
  public async deleteUserIntegration(
    userId: string,
    connectorId: string
  ): Promise<boolean> {
    const res = await IntegrationModel.deleteMany({
      userId: resolveUserFilter(userId),
      connectorId,
    });
    return res.deletedCount > 0;
  }

  /**
   * Toggles an integration on or off
   */
  public async toggleIntegration(
    userId: string,
    connectorId: string,
    enabled: boolean
  ): Promise<UserIntegration | null> {
    const doc = await IntegrationModel.findOneAndUpdate(
      { userId: resolveUserFilter(userId), connectorId },
      { enabled },
      { new: true }
    );
    if (!doc) return null;
    return this.mapDocumentToUserIntegration(doc);
  }

  /**
   * Tests connection with either saved or freshly provided credentials
   */
  public async testIntegration(
    userId: string,
    payload: TestIntegrationRequest
  ): Promise<TestIntegrationResponse> {
    const { connectorId, credentials, customConfig } = payload;
    let credsToTest: Record<string, string> = credentials || {};
    let configToTest = customConfig;

    // If no credentials supplied, fetch and decrypt from database
    if (
      (!credentials || Object.keys(credentials).length === 0) &&
      userId
    ) {
      const existing = await IntegrationModel.findOne({
        userId: resolveUserFilter(userId),
        connectorId,
      });
      if (existing && existing.encryptedCredentials?.cipherText) {
        try {
          credsToTest = encryptionService.decryptObject(existing.encryptedCredentials);
          if (!configToTest && existing.customConfig) {
            configToTest = existing.customConfig;
          }
        } catch (err: any) {
          return {
            success: false,
            message: `Failed to decrypt stored credentials: ${err.message}`,
          };
        }
      }
    }

    const connector =
      connectorRegistry.get(connectorId) ||
      connectorRegistry.get("custom_rest");

    if (!connector) {
      return {
        success: false,
        message: `Connector "${connectorId}" not found in registry`,
      };
    }

    try {
      const result = await connector.testConnection(credsToTest, configToTest);
      
      // Update integration status if saved in DB
      await IntegrationModel.findOneAndUpdate(
        { userId: resolveUserFilter(userId), connectorId },
        {
          status: result.success ? "connected" : "error",
          errorMessage: result.success ? undefined : result.message,
          lastTestedAt: new Date(),
        }
      );

      return result;
    } catch (err: any) {
      return {
        success: false,
        message: `Unexpected test connection error: ${err.message || String(err)}`,
      };
    }
  }

  /**
   * Dynamically instantiates and returns all agent tools for a user's active integrations
   */
  public async getToolsForUser(userId: string): Promise<AgentTool[]> {
    if (!userId) return [];

    try {
      const integrations = await IntegrationModel.find({
        userId: resolveUserFilter(userId),
        enabled: true,
        status: "connected",
      });

      const userTools: AgentTool[] = [];

      for (const integration of integrations) {
        try {
          let decryptedCreds: Record<string, string> = {};
          if (integration.encryptedCredentials?.cipherText) {
            decryptedCreds = encryptionService.decryptObject<
              Record<string, string>
            >(integration.encryptedCredentials);
          } else if (integration.maskedCredentials) {
            decryptedCreds =
              integration.maskedCredentials instanceof Map
                ? Object.fromEntries(integration.maskedCredentials)
                : (integration.maskedCredentials as Record<string, string>);
          }

          const connector =
            connectorRegistry.get(integration.connectorId) ||
            connectorRegistry.get("custom_rest");

          if (connector) {
            const tools = connector.createTools(
              decryptedCreds,
              integration.customConfig
            );
            userTools.push(...tools);
          }
        } catch (err) {
          logger.error(
            { err, connectorId: integration.connectorId, userId },
            "Failed to load tools for integration"
          );
        }
      }

      return userTools;
    } catch (err) {
      logger.error({ err, userId }, "Failed to query user integrations");
      return [];
    }
  }

  private mapDocumentToUserIntegration(doc: IIntegration): UserIntegration {
    return {
      id: doc._id.toString(),
      userId: doc.userId,
      connectorId: doc.connectorId,
      name: doc.name,
      category: doc.category,
      enabled: doc.enabled,
      status: doc.status,
      lastTestedAt: doc.lastTestedAt ? doc.lastTestedAt.toISOString() : undefined,
      errorMessage: doc.errorMessage,
      maskedCredentials:
        doc.maskedCredentials instanceof Map
          ? Object.fromEntries(doc.maskedCredentials)
          : doc.maskedCredentials || {},
      customConfig: doc.customConfig,
      createdAt: doc.createdAt ? doc.createdAt.toISOString() : new Date().toISOString(),
      updatedAt: doc.updatedAt ? doc.updatedAt.toISOString() : new Date().toISOString(),
    };
  }
}

export const integrationService = new IntegrationService();
