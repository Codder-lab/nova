import type {
  ConnectorMeta,
  SaveIntegrationRequest,
  TestIntegrationRequest,
  TestIntegrationResponse,
  UserIntegration,
} from "@nova/shared";

const API_BASE = "/api/integrations";

export async function fetchConnectors(): Promise<ConnectorMeta[]> {
  const res = await fetch(`${API_BASE}/connectors`, { credentials: "include" });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || "Failed to fetch connectors");
  }
  return data.connectors || [];
}

export async function fetchUserIntegrations(): Promise<UserIntegration[]> {
  const res = await fetch(API_BASE, { credentials: "include" });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || "Failed to fetch user integrations");
  }
  return data.integrations || [];
}

export async function saveIntegration(
  payload: SaveIntegrationRequest
): Promise<UserIntegration> {
  const res = await fetch(API_BASE, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || "Failed to save integration");
  }
  return data.integration;
}

export async function testIntegration(
  payload: TestIntegrationRequest
): Promise<TestIntegrationResponse> {
  const res = await fetch(`${API_BASE}/test`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return await res.json();
}

export async function toggleIntegration(
  connectorId: string,
  enabled: boolean
): Promise<UserIntegration> {
  const res = await fetch(`${API_BASE}/${connectorId}/toggle`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || "Failed to toggle integration");
  }
  return data.integration;
}

export async function deleteIntegration(connectorId: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/${connectorId}`, {
    method: "DELETE",
    credentials: "include",
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || "Failed to delete integration");
  }
  return data.deleted || false;
}

export async function fetchGoogleAuthConfig(): Promise<{
  configured: boolean;
  clientId: string | null;
  redirectUri: string;
}> {
  const res = await fetch(`${API_BASE}/google/config`, { credentials: "include" });
  const data = await res.json();
  return {
    configured: data.configured || false,
    clientId: data.clientId || null,
    redirectUri: data.redirectUri || "",
  };
}

export async function fetchGoogleAuthUrl(
  connectorId: string,
  customCredentials?: { clientId?: string; clientSecret?: string }
): Promise<string> {
  const params = new URLSearchParams({ connectorId });
  if (customCredentials?.clientId) {
    params.set("clientId", customCredentials.clientId);
  }
  if (customCredentials?.clientSecret) {
    params.set("clientSecret", customCredentials.clientSecret);
  }

  const res = await fetch(`${API_BASE}/google/auth-url?${params.toString()}`, {
    credentials: "include",
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || "Failed to get Google authorization URL");
  }
  return data.url;
}
