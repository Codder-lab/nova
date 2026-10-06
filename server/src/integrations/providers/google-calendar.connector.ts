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

  if (token) {
    try {
      const probe = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (probe.ok) {
        return token;
      }
    } catch {
      // Ignore
    }
  }

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

export class GoogleCalendarConnector implements BaseConnector {
  public readonly id = "google_calendar";
  public readonly name = "Google Calendar";
  public readonly description =
    "View upcoming events, search schedule, create meetings, and manage Google Calendar events.";
  public readonly category = "productivity" as const;
  public readonly icon = "Calendar";
  public readonly authType = "oauth2" as const;
  public readonly capabilities = [
    "View Schedule",
    "Create Events",
    "Search Events",
    "Delete Events",
  ];
  public readonly documentationUrl =
    "https://developers.google.com/calendar/api/guides/overview";

  public readonly credentialFields = [
    {
      key: "accessToken",
      label: "Google OAuth Access Token",
      placeholder: "ya29...",
      type: "password" as const,
      required: true,
      description: "OAuth 2.0 Bearer token with calendar.readonly or calendar.events scope.",
    },
    {
      key: "calendarId",
      label: "Calendar ID (Optional)",
      placeholder: "primary",
      type: "text" as const,
      required: false,
      description: "Specific calendar ID. Leave blank to default to 'primary'.",
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

    const calendarId = credentials.calendarId?.trim() || "primary";

    try {
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}`,
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
          message: `Google Calendar authentication failed (HTTP ${response.status}): ${errorText}`,
        };
      }

      const data = (await response.json()) as any;
      return {
        success: true,
        message: `Connected successfully to Google Calendar "${data.summary || calendarId}" (Timezone: ${data.timeZone || "UTC"})`,
        details: {
          calendarId: data.id,
          summary: data.summary,
          timeZone: data.timeZone,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Failed to connect to Google Calendar: ${err.message || String(err)}`,
      };
    }
  }

  public createTools(credentials: Record<string, string>): AgentTool[] {
    const getCalendarId = () => credentials.calendarId?.trim() || "primary";

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

    // 1. List Events Tool
    const listEventsTool: AgentTool = {
      name: "google_calendar_list_events",
      description:
        "List upcoming Google Calendar events within a date range (defaults to the next 7 days).",
      riskLevel: "LOW",
      inputSchema: z.object({
        timeMin: z
          .string()
          .optional()
          .describe("Start of time range in ISO format (e.g., 2026-10-06T00:00:00Z). Defaults to now."),
        timeMax: z
          .string()
          .optional()
          .describe("End of time range in ISO format. Defaults to 7 days from now."),
        maxResults: z
          .number()
          .optional()
          .default(10)
          .describe("Maximum events to return (default: 10, max: 50)"),
      }),
      execute: async ({ timeMin, timeMax, maxResults = 10 }) => {
        const headers = await getHeaders();
        const calId = getCalendarId();

        const startIso = timeMin || new Date().toISOString();
        const endIso =
          timeMax || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        const limit = Math.min(50, Math.max(1, maxResults));

        const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
          calId
        )}/events?singleEvents=true&orderBy=startTime&timeMin=${encodeURIComponent(
          startIso
        )}&timeMax=${encodeURIComponent(endIso)}&maxResults=${limit}`;

        const res = await fetch(url, { headers });
        if (!res.ok) {
          throw new Error(`Google Calendar API error (${res.status}): ${await res.text()}`);
        }

        const data = (await res.json()) as any;
        const items = data.items || [];

        return {
          calendarId: calId,
          timeMin: startIso,
          timeMax: endIso,
          count: items.length,
          events: items.map((item: any) => ({
            id: item.id,
            summary: item.summary || "(No Title)",
            description: item.description,
            start: item.start?.dateTime || item.start?.date,
            end: item.end?.dateTime || item.end?.date,
            location: item.location,
            status: item.status,
            meetLink: item.hangoutLink,
            htmlLink: item.htmlLink,
            attendees: (item.attendees || []).map((a: any) => a.email),
          })),
        };
      },
    };

    // 2. Search Events Tool
    const searchEventsTool: AgentTool = {
      name: "google_calendar_search_events",
      description: "Search Google Calendar events by title, attendee, or description keywords.",
      riskLevel: "LOW",
      inputSchema: z.object({
        query: z.string().describe("Search keywords to find events"),
        maxResults: z
          .number()
          .optional()
          .default(10)
          .describe("Max events to return (default: 10)"),
      }),
      execute: async ({ query, maxResults = 10 }) => {
        const headers = await getHeaders();
        const calId = getCalendarId();
        const limit = Math.min(50, Math.max(1, maxResults));

        const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
          calId
        )}/events?singleEvents=true&q=${encodeURIComponent(query)}&maxResults=${limit}`;

        const res = await fetch(url, { headers });
        if (!res.ok) {
          throw new Error(`Google Calendar API error (${res.status}): ${await res.text()}`);
        }

        const data = (await res.json()) as any;
        const items = data.items || [];

        return {
          query,
          count: items.length,
          events: items.map((item: any) => ({
            id: item.id,
            summary: item.summary || "(No Title)",
            description: item.description,
            start: item.start?.dateTime || item.start?.date,
            end: item.end?.dateTime || item.end?.date,
            location: item.location,
            meetLink: item.hangoutLink,
            htmlLink: item.htmlLink,
          })),
        };
      },
    };

    // 3. Create Event Tool
    const createEventTool: AgentTool = {
      name: "google_calendar_create_event",
      description: "Schedule and create a new event on Google Calendar.",
      riskLevel: "MEDIUM",
      inputSchema: z.object({
        summary: z.string().describe("Title of the meeting or event"),
        startDateTime: z
          .string()
          .describe("Start datetime in ISO 8601 format, e.g. '2026-10-15T14:00:00Z'"),
        endDateTime: z
          .string()
          .describe("End datetime in ISO 8601 format, e.g. '2026-10-15T15:00:00Z'"),
        description: z.string().optional().describe("Description or agenda for the event"),
        location: z.string().optional().describe("Meeting location or virtual link"),
        attendees: z
          .array(z.string())
          .optional()
          .describe("List of attendee email addresses to invite"),
        timeZone: z.string().optional().describe("Timezone (e.g. 'America/New_York', 'UTC')"),
      }),
      execute: async ({
        summary,
        startDateTime,
        endDateTime,
        description,
        location,
        attendees,
        timeZone,
      }) => {
        const headers = await getHeaders();
        const calId = getCalendarId();

        const body: any = {
          summary,
          description,
          location,
          start: {
            dateTime: startDateTime,
            ...(timeZone ? { timeZone } : {}),
          },
          end: {
            dateTime: endDateTime,
            ...(timeZone ? { timeZone } : {}),
          },
        };

        if (attendees && attendees.length > 0) {
          body.attendees = attendees.map((email: string) => ({ email }));
        }

        const res = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events`,
          {
            method: "POST",
            headers,
            body: JSON.stringify(body),
          }
        );

        if (!res.ok) {
          throw new Error(`Google Calendar API error (${res.status}): ${await res.text()}`);
        }

        const data = (await res.json()) as any;
        return {
          success: true,
          id: data.id,
          summary: data.summary,
          htmlLink: data.htmlLink,
          start: data.start?.dateTime,
          end: data.end?.dateTime,
          message: `Created calendar event "${summary}" from ${startDateTime} to ${endDateTime}.`,
        };
      },
    };

    // 4. Delete Event Tool
    const deleteEventTool: AgentTool = {
      name: "google_calendar_delete_event",
      description: "Delete an event from Google Calendar by its event ID.",
      riskLevel: "HIGH",
      inputSchema: z.object({
        eventId: z.string().describe("The unique ID of the event to delete"),
      }),
      execute: async ({ eventId }) => {
        const headers = await getHeaders();
        const calId = getCalendarId();

        const res = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
            calId
          )}/events/${encodeURIComponent(eventId)}`,
          {
            method: "DELETE",
            headers,
          }
        );

        if (!res.ok) {
          throw new Error(`Google Calendar API error (${res.status}): ${await res.text()}`);
        }

        return {
          success: true,
          eventId,
          message: `Deleted Google Calendar event "${eventId}" successfully.`,
        };
      },
    };

    return [listEventsTool, searchEventsTool, createEventTool, deleteEventTool];
  }
}
