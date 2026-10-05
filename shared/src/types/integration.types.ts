export type IntegrationCategory =
  | "developer"
  | "communication"
  | "productivity"
  | "custom";

export type IntegrationAuthType =
  | "api_key"
  | "bearer_token"
  | "webhook"
  | "oauth2"
  | "basic"
  | "qr_code";

export interface ConnectorCredentialField {
  key: string;
  label: string;
  placeholder?: string;
  type: "text" | "password" | "url";
  required: boolean;
  description?: string;
}

export interface CustomActionParameter {
  name: string;
  type: "string" | "number" | "boolean";
  required: boolean;
  description: string;
}

export interface CustomActionDefinition {
  name: string;
  description: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  riskLevel: "low" | "medium" | "high";
  parameters: CustomActionParameter[];
}

export interface CustomAppConfig {
  baseUrl: string;
  authHeaderKey?: string;
  authPrefix?: string;
  actions: CustomActionDefinition[];
}

export interface ConnectorMeta {
  id: string;
  name: string;
  description: string;
  category: IntegrationCategory;
  icon: string;
  authType: IntegrationAuthType;
  credentialFields: ConnectorCredentialField[];
  documentationUrl?: string;
  isCustom?: boolean;
  capabilities?: string[];
}

export interface UserIntegration {
  id: string;
  userId: string;
  connectorId: string;
  name: string;
  category: IntegrationCategory;
  enabled: boolean;
  status: "connected" | "error" | "unconfigured";
  lastTestedAt?: string;
  errorMessage?: string;
  maskedCredentials: Record<string, string>;
  customConfig?: CustomAppConfig;
  createdAt: string;
  updatedAt: string;
}

export interface SaveIntegrationRequest {
  connectorId: string;
  credentials: Record<string, string>;
  enabled?: boolean;
  name?: string;
  customConfig?: CustomAppConfig;
}

export interface TestIntegrationRequest {
  connectorId: string;
  credentials?: Record<string, string>;
  customConfig?: CustomAppConfig;
}

export interface TestIntegrationResponse {
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
}
