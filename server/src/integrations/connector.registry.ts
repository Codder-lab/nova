import { ConnectorMeta } from "@nova/shared";
import { BaseConnector } from "./base/connector.interface";
import { GitHubConnector } from "./providers/github.connector";
import { SlackConnector } from "./providers/slack.connector";
import { DiscordConnector } from "./providers/discord.connector";
import { NotionConnector } from "./providers/notion.connector";
import { TelegramConnector } from "./providers/telegram.connector";
import { WhatsAppConnector } from "./providers/whatsapp.connector";
import { GmailConnector } from "./providers/gmail.connector";
import { GoogleCalendarConnector } from "./providers/google-calendar.connector";
import { CustomRestConnector } from "./providers/custom-rest.connector";
import { logger } from "../utils/logger";

export class ConnectorRegistry {
  private connectors: Map<string, BaseConnector> = new Map();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults(): void {
    this.register(new GitHubConnector());
    this.register(new GmailConnector());
    this.register(new GoogleCalendarConnector());
    this.register(new SlackConnector());
    this.register(new DiscordConnector());
    this.register(new NotionConnector());
    this.register(new TelegramConnector());
    this.register(new WhatsAppConnector());
    this.register(new CustomRestConnector());
  }

  public register(connector: BaseConnector): void {
    if (this.connectors.has(connector.id)) {
      logger.warn(
        { connectorId: connector.id },
        "Overwriting existing connector registration"
      );
    }
    this.connectors.set(connector.id, connector);
    logger.debug(
      { connectorId: connector.id, name: connector.name },
      "Connector registered"
    );
  }

  public get(id: string): BaseConnector | undefined {
    return this.connectors.get(id);
  }

  public getAll(): BaseConnector[] {
    return Array.from(this.connectors.values());
  }

  public getMetadataList(): ConnectorMeta[] {
    return this.getAll().map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      category: c.category,
      icon: c.icon,
      authType: c.authType,
      credentialFields: c.credentialFields,
      documentationUrl: c.documentationUrl,
      capabilities: c.capabilities,
      isCustom: c.isCustom,
    }));
  }
}

export const connectorRegistry = new ConnectorRegistry();
