export interface WhatsAppStatus {
  success: boolean;
  status: "disconnected" | "connecting" | "qr_ready" | "connected";
  isConnected: boolean;
  qrCode?: string;
  qrDataUrl?: string;
  user?: {
    id: string;
    name?: string;
    phone?: string;
  };
  autoReplyEnabled: boolean;
  lastActive?: string;
  lastError?: string;
}

const API_BASE = "/api/whatsapp";

export async function fetchWhatsAppStatus(): Promise<WhatsAppStatus> {
  const res = await fetch(`${API_BASE}/status`, { credentials: "include" });
  return await res.json();
}

export async function connectWhatsApp(): Promise<WhatsAppStatus> {
  const res = await fetch(`${API_BASE}/connect`, {
    method: "POST",
    credentials: "include",
  });
  return await res.json();
}

export async function disconnectWhatsApp(): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/disconnect`, {
    method: "POST",
    credentials: "include",
  });
  return await res.json();
}

export async function logoutWhatsApp(): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/logout`, {
    method: "POST",
    credentials: "include",
  });
  return await res.json();
}

export async function sendWhatsAppMessage(
  to: string,
  message: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  const res = await fetch(`${API_BASE}/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ to, message }),
  });
  return await res.json();
}

export async function updateWhatsAppSettings(
  autoReplyEnabled: boolean
): Promise<{ success: boolean; autoReplyEnabled: boolean }> {
  const res = await fetch(`${API_BASE}/settings`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ autoReplyEnabled }),
  });
  return await res.json();
}
