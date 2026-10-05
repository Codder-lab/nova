import { z } from "zod";
import {
  CustomActionDefinition,
  CustomAppConfig,
  RiskLevel,
} from "@nova/shared";
import { AgentTool } from "../../tools/base/agent-tool.interface";
import {
  BaseConnector,
  ConnectionTestResult,
} from "../base/connector.interface";

export class CustomRestConnector implements BaseConnector {
  public readonly id = "custom_rest";
  public readonly name = "Custom REST API";
  public readonly description =
    "Connect any internal or external REST API by providing an API endpoint, headers, and action schemas.";
  public readonly category = "custom" as const;
  public readonly icon = "Globe";
  public readonly authType = "api_key" as const;
  public readonly isCustom = true;
  public readonly capabilities = [
    "Any HTTP Endpoint",
    "Dynamic Schema Generation",
    "Custom Auth Headers",
    "JSON Payload Mapping",
  ];

  public readonly credentialFields = [
    {
      key: "apiKey",
      label: "API Key / Token / Secret",
      placeholder: "Secret token or API key",
      type: "password" as const,
      required: false,
      description: "Optional authentication credential used in the Authorization header.",
    },
  ];

  public async testConnection(
    credentials: Record<string, string>,
    config?: Record<string, unknown> | CustomAppConfig
  ): Promise<ConnectionTestResult> {
    const customConfig = config as CustomAppConfig | undefined;
    if (!customConfig || !customConfig.baseUrl) {
      return {
        success: false,
        message: "Base URL is required to test a Custom REST integration",
      };
    }

    try {
      const headers = this.buildHeaders(credentials, customConfig);
      const url = customConfig.baseUrl.trim();

      const response = await fetch(url, {
        method: "GET",
        headers,
      });

      return {
        success: response.ok,
        message: response.ok
          ? `Connected to ${url} (HTTP ${response.status})`
          : `HTTP ${response.status} ${response.statusText} from ${url}`,
        details: { status: response.status },
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Network error reaching ${customConfig?.baseUrl}: ${
          err.message || String(err)
        }`,
      };
    }
  }

  public createTools(
    credentials: Record<string, string>,
    config?: Record<string, unknown> | CustomAppConfig
  ): AgentTool[] {
    const customConfig = config as CustomAppConfig | undefined;
    if (!customConfig || !customConfig.actions || !Array.isArray(customConfig.actions)) {
      return [];
    }

    const headers = this.buildHeaders(credentials, customConfig);
    const baseUrl = customConfig.baseUrl.replace(/\/+$/, "");

    return customConfig.actions.map((action) =>
      this.buildToolFromAction(action, baseUrl, headers)
    );
  }

  private buildHeaders(
    credentials: Record<string, string>,
    config: CustomAppConfig
  ): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "User-Agent": "Nova-Assistant",
    };

    const token = credentials?.apiKey?.trim() || "";
    if (token) {
      const headerKey = config.authHeaderKey?.trim() || "Authorization";
      const prefix = config.authPrefix !== undefined ? config.authPrefix : "Bearer ";
      headers[headerKey] = `${prefix}${token}`.trim();
    }

    return headers;
  }

  private buildToolFromAction(
    action: CustomActionDefinition,
    baseUrl: string,
    baseHeaders: Record<string, string>
  ): AgentTool {
    // 1. Build dynamic Zod Schema from parameters
    const shape: Record<string, z.ZodTypeAny> = {};
    for (const param of action.parameters || []) {
      let schema: z.ZodTypeAny;
      if (param.type === "number") {
        schema = z.number();
      } else if (param.type === "boolean") {
        schema = z.boolean();
      } else {
        schema = z.string();
      }

      if (param.description) {
        schema = schema.describe(param.description);
      }
      if (!param.required) {
        schema = schema.optional();
      }
      shape[param.name] = schema;
    }

    const inputSchema = z.object(shape);

    // Map risk level
    let riskLevel: RiskLevel = "LOW";
    if (action.riskLevel === "high") {
      riskLevel = "HIGH";
    } else if (action.riskLevel === "medium") {
      riskLevel = "MEDIUM";
    }

    return {
      name: action.name,
      description: action.description,
      riskLevel,
      inputSchema,
      execute: async (input: Record<string, any>) => {
        let path = action.path.startsWith("/") ? action.path : `/${action.path}`;
        const remainingParams = { ...input };

        // Replace path params e.g. :id or {id}
        for (const [key, val] of Object.entries(input)) {
          const colonPattern = new RegExp(`:${key}\\b`, "g");
          const bracePattern = new RegExp(`\\{${key}\\}`, "g");
          if (colonPattern.test(path) || bracePattern.test(path)) {
            path = path
              .replace(colonPattern, encodeURIComponent(String(val)))
              .replace(bracePattern, encodeURIComponent(String(val)));
            delete remainingParams[key];
          }
        }

        let fullUrl = `${baseUrl}${path}`;
        const method = action.method.toUpperCase();
        const reqHeaders = { ...baseHeaders };
        let body: string | undefined;

        if (method === "GET" || method === "DELETE") {
          const query = new URLSearchParams();
          for (const [k, v] of Object.entries(remainingParams)) {
            if (v !== undefined && v !== null) {
              query.append(k, String(v));
            }
          }
          const qs = query.toString();
          if (qs) {
            fullUrl += (fullUrl.includes("?") ? "&" : "?") + qs;
          }
        } else {
          // POST / PUT / PATCH
          reqHeaders["Content-Type"] = "application/json";
          body = JSON.stringify(remainingParams);
        }

        const res = await fetch(fullUrl, {
          method,
          headers: reqHeaders,
          body,
        });

        const contentType = res.headers.get("content-type") || "";
        let responseData: any;
        if (contentType.includes("application/json")) {
          responseData = await res.json();
        } else {
          responseData = await res.text();
        }

        if (!res.ok) {
          throw new Error(
            `Custom API call to ${action.name} failed (${res.status}): ${
              typeof responseData === "string"
                ? responseData
                : JSON.stringify(responseData)
            }`
          );
        }

        return {
          status: res.status,
          data: responseData,
        };
      },
    };
  }
}
