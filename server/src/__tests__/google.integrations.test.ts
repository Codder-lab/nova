import { describe, it, expect, vi, beforeEach } from "vitest";
import { connectorRegistry } from "../integrations/connector.registry";
import { GmailConnector } from "../integrations/providers/gmail.connector";
import { GoogleCalendarConnector } from "../integrations/providers/google-calendar.connector";

describe("Google Workspace Integrations (Gmail & Google Calendar)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. Gmail Connector Registration & Metadata", () => {
    it("should be registered in connectorRegistry", () => {
      const connector = connectorRegistry.get("gmail");
      expect(connector).toBeDefined();
      expect(connector?.name).toBe("Gmail");
      expect(connector?.category).toBe("communication");
      expect(connector?.authType).toBe("oauth2");
    });

    it("should expose valid credential fields and capabilities", () => {
      const gmail = new GmailConnector();
      expect(gmail.capabilities).toContain("Search Emails");
      expect(gmail.capabilities).toContain("Send Emails");
      expect(gmail.capabilities).toContain("Read Threads");
      expect(gmail.capabilities).toContain("Create Drafts");

      const accessField = gmail.credentialFields.find((f) => f.key === "accessToken");
      expect(accessField).toBeDefined();
      expect(accessField?.required).toBe(true);
      expect(accessField?.type).toBe("password");
    });

    it("should fail testConnection when access token is missing", async () => {
      const gmail = new GmailConnector();
      const result = await gmail.testConnection({});
      expect(result.success).toBe(false);
      expect(result.message).toContain("Google OAuth Access Token is required");
    });

    it("should successfully test connection when Google profile is returned", async () => {
      const gmail = new GmailConnector();
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          emailAddress: "alex.nova@gmail.com",
          messagesTotal: 1420,
          threadsTotal: 890,
        }),
      } as any);

      const result = await gmail.testConnection({ accessToken: "ya29.mock-valid-token" });
      expect(result.success).toBe(true);
      expect(result.message).toContain("alex.nova@gmail.com");
      expect(result.message).toContain("1420");
    });

    it("should generate 4 valid Gmail agent tools", () => {
      const gmail = new GmailConnector();
      const tools = gmail.createTools({ accessToken: "ya29.mock-token" });

      expect(tools.length).toBe(4);
      const toolNames = tools.map((t) => t.name);
      expect(toolNames).toContain("gmail_search_emails");
      expect(toolNames).toContain("gmail_read_email");
      expect(toolNames).toContain("gmail_send_email");
      expect(toolNames).toContain("gmail_create_draft");

      const sendTool = tools.find((t) => t.name === "gmail_send_email");
      expect(sendTool?.riskLevel).toBe("MEDIUM");

      const searchTool = tools.find((t) => t.name === "gmail_search_emails");
      expect(searchTool?.riskLevel).toBe("LOW");
    });

    it("should execute gmail_send_email and post RFC 2822 base64url payload", async () => {
      const gmail = new GmailConnector();
      const tools = gmail.createTools({ accessToken: "ya29.mock-token" });
      const sendTool = tools.find((t) => t.name === "gmail_send_email")!;

      global.fetch = vi.fn().mockImplementation((url: string, opts: any) => {
        if (url.includes("users/me/profile")) {
          return Promise.resolve({ ok: true });
        }
        if (url.includes("users/me/messages/send")) {
          const body = JSON.parse(opts.body);
          expect(body.raw).toBeDefined();
          // Decode raw base64url to verify recipient & subject
          const decoded = Buffer.from(body.raw, "base64url").toString("utf-8");
          expect(decoded).toContain("To: user@example.com");
          expect(decoded).toContain("Subject:");
          expect(decoded).toContain("Project Update");
          return Promise.resolve({
            ok: true,
            json: async () => ({ id: "msg_9988", threadId: "th_1122" }),
          });
        }
        return Promise.reject(new Error("Unknown URL"));
      });

      const result = await sendTool.execute(
        {
          to: "user@example.com",
          subject: "Project Update",
          body: "Nova is progressing smoothly according to plan.",
        },
        { userId: "test" } as any,
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBe("msg_9988");
      expect(result.message).toContain("user@example.com");
    });
  });

  describe("2. Google Calendar Connector Registration & Metadata", () => {
    it("should be registered in connectorRegistry", () => {
      const connector = connectorRegistry.get("google_calendar");
      expect(connector).toBeDefined();
      expect(connector?.name).toBe("Google Calendar");
      expect(connector?.category).toBe("productivity");
      expect(connector?.authType).toBe("oauth2");
    });

    it("should expose valid credential fields and capabilities", () => {
      const calendar = new GoogleCalendarConnector();
      expect(calendar.capabilities).toContain("View Schedule");
      expect(calendar.capabilities).toContain("Create Events");
      expect(calendar.capabilities).toContain("Search Events");
      expect(calendar.capabilities).toContain("Delete Events");

      const accessField = calendar.credentialFields.find((f) => f.key === "accessToken");
      expect(accessField).toBeDefined();
      expect(accessField?.required).toBe(true);

      const calIdField = calendar.credentialFields.find((f) => f.key === "calendarId");
      expect(calIdField).toBeDefined();
      expect(calIdField?.required).toBe(false);
    });

    it("should fail testConnection when access token is missing", async () => {
      const calendar = new GoogleCalendarConnector();
      const result = await calendar.testConnection({});
      expect(result.success).toBe(false);
      expect(result.message).toContain("Google OAuth Access Token is required");
    });

    it("should successfully test connection when Calendar API returns calendar metadata", async () => {
      const calendar = new GoogleCalendarConnector();
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: "primary",
          summary: "Alex Personal Calendar",
          timeZone: "America/New_York",
        }),
      } as any);

      const result = await calendar.testConnection({ accessToken: "ya29.mock-token" });
      expect(result.success).toBe(true);
      expect(result.message).toContain("Alex Personal Calendar");
      expect(result.message).toContain("America/New_York");
    });

    it("should generate 4 valid Google Calendar agent tools", () => {
      const calendar = new GoogleCalendarConnector();
      const tools = calendar.createTools({ accessToken: "ya29.mock-token" });

      expect(tools.length).toBe(4);
      const toolNames = tools.map((t) => t.name);
      expect(toolNames).toContain("google_calendar_list_events");
      expect(toolNames).toContain("google_calendar_search_events");
      expect(toolNames).toContain("google_calendar_create_event");
      expect(toolNames).toContain("google_calendar_delete_event");

      const deleteTool = tools.find((t) => t.name === "google_calendar_delete_event");
      expect(deleteTool?.riskLevel).toBe("HIGH");

      const createTool = tools.find((t) => t.name === "google_calendar_create_event");
      expect(createTool?.riskLevel).toBe("MEDIUM");

      const listTool = tools.find((t) => t.name === "google_calendar_list_events");
      expect(listTool?.riskLevel).toBe("LOW");
    });

    it("should execute google_calendar_create_event and post structured payload", async () => {
      const calendar = new GoogleCalendarConnector();
      const tools = calendar.createTools({ accessToken: "ya29.mock-token" });
      const createTool = tools.find((t) => t.name === "google_calendar_create_event")!;

      global.fetch = vi.fn().mockImplementation((url: string, opts: any) => {
        if (url.includes("users/me/calendarList")) {
          return Promise.resolve({ ok: true });
        }
        if (url.includes("calendars/primary/events")) {
          const body = JSON.parse(opts.body);
          expect(body.summary).toBe("Q3 Strategic Roadmap Review");
          expect(body.start.dateTime).toBe("2026-10-10T14:00:00Z");
          expect(body.end.dateTime).toBe("2026-10-10T15:00:00Z");
          expect(body.attendees[0].email).toBe("team@company.com");
          return Promise.resolve({
            ok: true,
            json: async () => ({
              id: "evt_776655",
              summary: body.summary,
              htmlLink: "https://calendar.google.com/event?eid=123",
              start: body.start,
              end: body.end,
            }),
          });
        }
        return Promise.reject(new Error("Unknown URL"));
      });

      const result = await createTool.execute(
        {
          summary: "Q3 Strategic Roadmap Review",
          startDateTime: "2026-10-10T14:00:00Z",
          endDateTime: "2026-10-10T15:00:00Z",
          location: "Google Meet",
          attendees: ["team@company.com"],
        },
        { userId: "test" } as any,
      );

      expect(result.success).toBe(true);
      expect(result.id).toBe("evt_776655");
      expect(result.summary).toBe("Q3 Strategic Roadmap Review");
      expect(result.htmlLink).toContain("calendar.google.com");
    });
  });
});
