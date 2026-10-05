import { AgentTool } from "../../tools/base/agent-tool.interface";
import {
  ConnectorCredentialField,
  CustomAppConfig,
  IntegrationAuthType,
  IntegrationCategory,
} from "@nova/shared";

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
}

export interface BaseConnector {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: IntegrationCategory;
  readonly icon: string;
  readonly authType: IntegrationAuthType;
  readonly credentialFields: ConnectorCredentialField[];
  readonly documentationUrl?: string;
  readonly capabilities?: string[];
  readonly isCustom?: boolean;

  /**
   * Tests whether the provided credentials are valid against the remote service API
   */
  testConnection(
    credentials: Record<string, string>,
    config?: Record<string, unknown> | CustomAppConfig
  ): Promise<ConnectionTestResult>;

  /**
   * Instantiates executable agent tools bound to the user's credentials
   */
  createTools(
    credentials: Record<string, string>,
    config?: Record<string, unknown> | CustomAppConfig
  ): AgentTool[];
}
