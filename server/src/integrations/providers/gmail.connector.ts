import { z } from "zod";
import { AgentTool } from "../../tools/base/agent-tool.interface";
import {
  BaseConnector,
  ConnectionTestResult,
} from "../base/connector.interface";

async function resolveGoogleAccessToken(credentials: Record<string, string>): Promise<string | null> {
  let token = credentials.accessToken?.trim();
  const refreshToken = credentials.refreshToken?.trim();
  const clientId = credentials.clientId?.trim();
  const clientSecret = credentials.clientSecret?.trim();

  // If we have an existing token, test if it's usable
  if (token) {
    try {
      const probe = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (probe.ok) {
        return token;
      }
    } catch {
      // Ignore and attempt refresh if possible
    }
  }

  // Attempt to refresh if refresh token & client credentials exist
  if (refreshToken && clientId && clientSecret) {
    try {
      const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        }),
      });

      if (refreshRes.ok) {
        const refreshData = (await refreshRes.json()) as any;
        if (refreshData.access_token) {
          credentials.accessToken = refreshData.access_token;
          return refreshData.access_token;
        }
      }
    } catch {
      // Fall through
    }
  }

  return token || null;
}

export class GmailConnector implements BaseConnector {
  public readonly id = "gmail";
  public readonly name = "Gmail";
  public readonly description =
    "Search your inbox, read threads, compose drafts, and send emails via Google Workspace & Gmail.";
  public readonly category = "communication" as const;
  public readonly icon = "Mail";
  public readonly authType = "oauth2" as const;
  public readonly capabilities = [
    "Search Emails",
    "Read Threads",
    "Send Emails",
    "Create Drafts",
  ];
  public readonly documentationUrl =
    "https://developers.google.com/gmail/api/guides";

  public readonly credentialFields = [
    {
      key: "accessToken",
      label: "Google OAuth Access Token",
      placeholder: "ya29...",
      type: "password" as const,
      required: true,
      description: "Google OAuth 2.0 Bearer token with gmail.readonly, gmail.send, or gmail.compose scope.",
    },
    {
      key: "refreshToken",
      label: "OAuth Refresh Token (Optional)",
      placeholder: "1//04...",
      type: "password" as const,
      required: false,
      description: "Optional OAuth2 refresh token for persistent automatic token renewals.",
    },
    {
      key: "clientId",
      label: "Google Cloud Client ID (Optional)",
      placeholder: "...apps.googleusercontent.com",
      type: "text" as const,
      required: false,
      description: "Required only when providing a Refresh Token.",
    },
    {
      key: "clientSecret",
      label: "Google Cloud Client Secret (Optional)",
      placeholder: "GOCSPX-...",
      type: "password" as const,
      required: false,
      description: "Required only when providing a Refresh Token.",
    },
  ];

  public async testConnection(
    credentials: Record<string, string>
  ): Promise<ConnectionTestResult> {
    const token = await resolveGoogleAccessToken(credentials);
    if (!token) {
      return {
        success: false,
        message: "Google OAuth Access Token is required.",
      };
    }

    try {
      const response = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/profile",
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          message: `Gmail API authentication failed (HTTP ${response.status}): ${errorText}`,
        };
      }

      const profile = (await response.json()) as any;
      return {
        success: true,
        message: `Connected successfully to Gmail as ${profile.emailAddress} (${profile.messagesTotal || 0} total messages)`,
        details: {
          emailAddress: profile.emailAddress,
          messagesTotal: profile.messagesTotal,
          threadsTotal: profile.threadsTotal,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Failed to connect to Gmail: ${err.message || String(err)}`,
      };
    }
  }

  public createTools(credentials: Record<string, string>): AgentTool[] {
    const getHeaders = async () => {
      const token = await resolveGoogleAccessToken(credentials);
      if (!token) {
        throw new Error("Missing or invalid Google OAuth Access Token.");
      }
      return {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      };
    };

    // 1. Search Emails Tool
    const searchEmailsTool: AgentTool = {
      name: "gmail_search_emails",
      description:
        "Search emails in Gmail using Google search query syntax (e.g., 'is:unread', 'from:colleague@example.com', 'subject:meeting', 'newer_than:2d').",
      riskLevel: "LOW",
      inputSchema: z.object({
        query: z.string().describe("Search query syntax, e.g. 'is:unread' or 'from:john'"),
        maxResults: z
          .number()
          .optional()
          .default(5)
          .describe("Maximum number of emails to retrieve (default: 5, max: 20)"),
      }),
      execute: async ({ query, maxResults = 5 }) => {
        const headers = await getHeaders();
        const limit = Math.min(20, Math.max(1, maxResults));
        const listRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(
            query
          )}&maxResults=${limit}`,
          { headers }
        );

        if (!listRes.ok) {
          throw new Error(`Gmail API error (${listRes.status}): ${await listRes.text()}`);
        }

        const listData = (await listRes.json()) as any;
        const messages = listData.messages || [];

        if (messages.length === 0) {
          return {
            query,
            resultCount: 0,
            messages: [],
            note: "No matching emails found for this query.",
          };
        }

        // Fetch metadata headers for each message in parallel
        const messageDetails = await Promise.all(
          messages.slice(0, limit).map(async (msg: { id: string; threadId: string }) => {
            try {
              const itemRes = await fetch(
                `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date&metadataHeaders=To`,
                { headers }
              );
              if (!itemRes.ok) return { id: msg.id, threadId: msg.threadId };
              const itemData = (await itemRes.json()) as any;
              const headersList = itemData.payload?.headers || [];
              const getHeader = (name: string) =>
                headersList.find((h: any) => h.name.toLowerCase() === name.toLowerCase())
                  ?.value || "";

              return {
                id: msg.id,
                threadId: msg.threadId,
                snippet: itemData.snippet || "",
                from: getHeader("From"),
                to: getHeader("To"),
                subject: getHeader("Subject") || "(No Subject)",
                date: getHeader("Date"),
              };
            } catch {
              return { id: msg.id, threadId: msg.threadId };
            }
          })
        );

        return {
          query,
          resultCount: messageDetails.length,
          messages: messageDetails,
        };
      },
    };

    // 2. Read Full Email Tool
    const readEmailTool: AgentTool = {
      name: "gmail_read_email",
      description: "Read the full contents, body, and headers of a specific Gmail message by its ID.",
      riskLevel: "LOW",
      inputSchema: z.object({
        messageId: z.string().describe("The unique ID of the Gmail message to read"),
      }),
      execute: async ({ messageId }) => {
        const headers = await getHeaders();
        const res = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(
            messageId
          )}?format=full`,
          { headers }
        );

        if (!res.ok) {
          throw new Error(`Gmail API error (${res.status}): ${await res.text()}`);
        }

        const data = (await res.json()) as any;
        const headersList = data.payload?.headers || [];
        const getHeader = (name: string) =>
          headersList.find((h: any) => h.name.toLowerCase() === name.toLowerCase())
            ?.value || "";

        // Extract body text from parts or body
        let bodyText = "";
        const extractBody = (part: any) => {
          if (part.mimeType === "text/plain" && part.body?.data) {
            bodyText += Buffer.from(part.body.data, "base64url").toString("utf-8") + "\n";
          } else if (part.parts && Array.isArray(part.parts)) {
            for (const subPart of part.parts) {
              extractBody(subPart);
            }
          }
        };

        if (data.payload?.body?.data) {
          bodyText = Buffer.from(data.payload.body.data, "base64url").toString("utf-8");
        } else if (data.payload?.parts) {
          extractBody(data.payload);
        }

        return {
          id: data.id,
          threadId: data.threadId,
          from: getHeader("From"),
          to: getHeader("To"),
          subject: getHeader("Subject") || "(No Subject)",
          date: getHeader("Date"),
          snippet: data.snippet,
          body: bodyText.trim() || data.snippet || "(No readable body)",
        };
      },
    };

    // 3. Send Email Tool
    const sendEmailTool: AgentTool = {
      name: "gmail_send_email",
      description: "Send an email message via Gmail. Please double check recipient address and subject.",
      riskLevel: "MEDIUM",
      inputSchema: z.object({
        to: z.string().describe("Recipient email address or comma-separated addresses"),
        subject: z.string().describe("Subject of the email"),
        body: z.string().describe("Plain text body of the email message"),
        cc: z.string().optional().describe("Optional CC recipient email address(es)"),
      }),
      execute: async ({ to, subject, body, cc }) => {
        const headers = await getHeaders();

        // Construct RFC 2822 email format
        const cleanSubject = /^[\x20-\x7E]*$/.test(subject)
          ? subject
          : `=?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`;

        const lines: string[] = [
          `To: ${to}`,
          `Subject: ${cleanSubject}`,
          'MIME-Version: 1.0',
          'Content-Type: text/plain; charset="UTF-8"',
        ];

        if (cc) {
          lines.splice(1, 0, `Cc: ${cc}`);
        }

        const rawMime = `${lines.join("\r\n")}\r\n\r\n${body}`;
        const base64UrlEmail = Buffer.from(rawMime).toString("base64url");

        const res = await fetch(
          "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
          {
            method: "POST",
            headers,
            body: JSON.stringify({ raw: base64UrlEmail }),
          }
        );

        if (!res.ok) {
          throw new Error(`Gmail API error (${res.status}): ${await res.text()}`);
        }

        const sendData = (await res.json()) as any;
        return {
          success: true,
          messageId: sendData.id,
          threadId: sendData.threadId,
          message: `Email sent successfully to ${to} with subject "${subject}".`,
        };
      },
    };

    // 4. Create Draft Tool
    const createDraftTool: AgentTool = {
      name: "gmail_create_draft",
      description: "Create a draft email in Gmail without sending it immediately.",
      riskLevel: "LOW",
      inputSchema: z.object({
        to: z.string().describe("Recipient email address"),
        subject: z.string().describe("Draft email subject"),
        body: z.string().describe("Draft plain text body"),
      }),
      execute: async ({ to, subject, body }) => {
        const headers = await getHeaders();

        const cleanSubject = /^[\x20-\x7E]*$/.test(subject)
          ? subject
          : `=?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`;

        const rawMime = [
          `To: ${to}`,
          `Subject: ${cleanSubject}`,
          'MIME-Version: 1.0',
          'Content-Type: text/plain; charset="UTF-8"',
          "",
          body,
        ].join("\r\n");

        const base64UrlEmail = Buffer.from(rawMime).toString("base64url");

        const res = await fetch(
          "https://gmail.googleapis.com/gmail/v1/users/me/drafts",
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              message: { raw: base64UrlEmail },
            }),
          }
        );

        if (!res.ok) {
          throw new Error(`Gmail API error (${res.status}): ${await res.text()}`);
        }

        const draftData = (await res.json()) as any;
        return {
          success: true,
          draftId: draftData.id,
          message: `Created Gmail draft to ${to} with subject "${subject}".`,
        };
      },
    };

    return [searchEmailsTool, readEmailTool, sendEmailTool, createDraftTool];
  }
}
