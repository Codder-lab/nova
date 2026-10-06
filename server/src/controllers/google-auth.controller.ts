import { Request, Response } from "express";
import crypto from "crypto";
import { env } from "../config/env";
import { integrationService } from "../services/integration.service";
import { logger } from "../utils/logger";

const GMAIL_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.compose",
];

const CALENDAR_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
];

const COMBINED_SCOPES = Array.from(new Set([...GMAIL_SCOPES, ...CALENDAR_SCOPES]));

function getUserId(req: Request): string {
  return (
    req.user?.userId ||
    (req.headers["x-user-id"] as string) ||
    (req.query.userId as string) ||
    "cli-user"
  );
}

function getRedirectUri(): string {
  return (
    env.GOOGLE_REDIRECT_URI ||
    `http://localhost:${env.PORT || 5000}/api/integrations/google/callback`
  );
}

export function getGoogleAuthConfig(_req: Request, res: Response): void {
  const isConfigured = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
  res.json({
    success: true,
    configured: isConfigured,
    clientId: env.GOOGLE_CLIENT_ID ? `${env.GOOGLE_CLIENT_ID.slice(0, 15)}...` : null,
    redirectUri: getRedirectUri(),
  });
}

export function getGoogleAuthUrl(req: Request, res: Response): void {
  try {
    const userId = getUserId(req);
    const connectorId = (req.query.connectorId as string) || "all";
    const customClientId = req.query.clientId as string | undefined;
    const customClientSecret = req.query.clientSecret as string | undefined;

    const clientId = customClientId || env.GOOGLE_CLIENT_ID;
    const clientSecret = customClientSecret || env.GOOGLE_CLIENT_SECRET;

    if (!clientId) {
      res.status(400).json({
        success: false,
        configured: false,
        error:
          "Google Client ID is not configured. Please set GOOGLE_CLIENT_ID in server/.env or provide it in the connection dialog.",
      });
      return;
    }

    let scopes = COMBINED_SCOPES;
    if (connectorId === "gmail") {
      scopes = GMAIL_SCOPES;
    } else if (connectorId === "google_calendar") {
      scopes = CALENDAR_SCOPES;
    }

    const redirectUri = (req.query.redirectUri as string) || getRedirectUri();

    const statePayload = {
      userId,
      connectorId,
      clientId: customClientId || "",
      clientSecret: customClientSecret || "",
      redirectUri,
      nonce: crypto.randomBytes(16).toString("hex"),
      timestamp: Date.now(),
    };

    const state = Buffer.from(JSON.stringify(statePayload)).toString("base64url");

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", scopes.join(" "));
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set("include_granted_scopes", "true");
    authUrl.searchParams.set("state", state);

    res.json({
      success: true,
      configured: true,
      url: authUrl.toString(),
      redirectUri,
    });
  } catch (err: any) {
    logger.error({ err }, "Failed to generate Google auth URL");
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function handleGoogleCallback(req: Request, res: Response): Promise<void> {
  const { code, state, error } = req.query;
  const clientBaseUrl = env.CLIENT_URL || "http://localhost:5173";

  if (error || !code || !state) {
    const errorMsg = (error as string) || "Authentication was cancelled or missing code.";
    res.status(400).send(renderCallbackHtml(false, errorMsg, clientBaseUrl));
    return;
  }

  try {
    let stateData: any;
    try {
      stateData = JSON.parse(Buffer.from(state as string, "base64url").toString("utf-8"));
    } catch {
      throw new Error("Invalid or corrupted state token.");
    }

    const { userId, connectorId, clientId: stateClientId, clientSecret: stateClientSecret } =
      stateData;

    const clientId = stateClientId || env.GOOGLE_CLIENT_ID;
    const clientSecret = stateClientSecret || env.GOOGLE_CLIENT_SECRET;
    const redirectUri = stateData.redirectUri || getRedirectUri();

    if (!clientId || !clientSecret) {
      throw new Error(
        "Google Client ID or Client Secret is missing. Set GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET in server/.env."
      );
    }

    // Exchange authorization code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: code as string,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      logger.error({ status: tokenRes.status, body: errBody }, "Google token exchange failed");
      throw new Error(`Google token exchange failed: ${errBody}`);
    }

    const tokenData = (await tokenRes.json()) as any;
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;

    // Fetch user profile from Google to get email
    let userEmail = "";
    try {
      const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (profileRes.ok) {
        const profile = (await profileRes.json()) as any;
        userEmail = profile.email || "";
      }
    } catch (e) {
      logger.warn({ e }, "Could not fetch Google user profile email");
    }

    const credentials: Record<string, string> = {
      accessToken,
      ...(refreshToken ? { refreshToken } : {}),
      clientId,
      clientSecret,
      ...(userEmail ? { email: userEmail, emailAddress: userEmail } : {}),
    };

    // Save to requested connector(s)
    const connectorsToSave =
      connectorId === "all" ? ["gmail", "google_calendar"] : [connectorId];

    for (const cid of connectorsToSave) {
      await integrationService.saveUserIntegration(userId || "cli-user", {
        connectorId: cid,
        name: cid === "gmail" ? "Gmail" : "Google Calendar",
        enabled: true,
        credentials,
      });
      logger.info(
        { userId, connectorId: cid, email: userEmail },
        "Google Workspace integration connected successfully via OAuth"
      );
    }

    res.send(
      renderCallbackHtml(
        true,
        `Connected Google account${userEmail ? ` (${userEmail})` : ""} successfully!`,
        clientBaseUrl,
        connectorId,
        userEmail
      )
    );
  } catch (err: any) {
    logger.error({ err }, "Google OAuth callback error");
    res.status(500).send(renderCallbackHtml(false, err.message, clientBaseUrl));
  }
}

function renderCallbackHtml(
  success: boolean,
  message: string,
  clientUrl: string,
  connectorId?: string,
  email?: string
): string {
  const icon = success ? "✓" : "✕";
  const color = success ? "#10B981" : "#EF4444";
  const title = success ? "Connection Successful" : "Authentication Failed";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #09090B;
      color: #FAFAFA;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 20px;
      box-sizing: border-box;
    }
    .card {
      background-color: #18181B;
      border: 1px solid #27272A;
      border-radius: 12px;
      padding: 32px 28px;
      max-width: 420px;
      width: 100%;
      text-align: center;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
    }
    .icon {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background-color: ${color}20;
      color: ${color};
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      font-weight: bold;
      margin: 0 auto 20px auto;
      border: 1px solid ${color}40;
    }
    h2 {
      margin: 0 0 8px 0;
      font-size: 1.25rem;
      font-weight: 600;
    }
    p {
      color: #A1A1AA;
      font-size: 0.875rem;
      margin: 0 0 24px 0;
      line-height: 1.5;
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 9999px;
      background: #27272A;
      color: #E4E4E7;
      font-size: 0.75rem;
      font-family: monospace;
      margin-bottom: 16px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h2>${title}</h2>
    ${email ? `<div class="badge">${email}</div>` : ""}
    <p>${message}</p>
    <p style="font-size: 0.75rem; color: #71717A;">This window will close automatically...</p>
  </div>
  <script>
    const payload = {
      type: '${success ? "GOOGLE_OAUTH_SUCCESS" : "GOOGLE_OAUTH_ERROR"}',
      success: ${success},
      connectorId: '${connectorId || "gmail"}',
      email: '${email || ""}',
      message: '${message.replace(/'/g, "\\'")}'
    };

    if (window.opener) {
      window.opener.postMessage(payload, '*');
      setTimeout(() => {
        window.close();
      }, 1500);
    } else {
      setTimeout(() => {
        window.location.href = '${clientUrl}';
      }, 2000);
    }
  </script>
</body>
</html>`;
}
