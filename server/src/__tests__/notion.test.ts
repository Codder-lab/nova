import { describe, it, expect, vi, beforeEach } from "vitest";
import { NotionConnector } from "../integrations/providers/notion.connector";

describe("NotionConnector - notion_create_page block parser & chunking", () => {
  const connector = new NotionConnector();
  const tools = connector.createTools({ apiKey: "secret_test_notion_key" });
  const createPageTool = tools.find((t) => t.name === "notion_create_page");

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should parse markdown headings, checklists, and chunk long content (>2000 chars) into valid Notion blocks", async () => {
    expect(createPageTool).toBeDefined();

    // Generate a long text exceeding 2000 characters
    const longParagraph = "A".repeat(3500);
    const content = `# Executive Onboarding\n\n## Week 1: Foundation\n- [ ] Meet with CEO\n- [x] Review security policies\n- Regular bullet point\n\n${longParagraph}`;

    let capturedRequestBody: any = null;

    vi.spyOn(global, "fetch").mockImplementation(async (url: any, options: any) => {
      if (url.toString().includes("/v1/pages")) {
        capturedRequestBody = JSON.parse(options.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: "new-page-id-12345",
            url: "https://www.notion.so/new-page-id-12345",
          }),
        } as any;
      }
      return { ok: true, status: 200, json: async () => ({}) } as any;
    });

    const result = (await createPageTool?.execute(
      {
        parentPageId: "354ee125-9771-0042-0e0a-dccb1497f850",
        title: "Executive Onboarding Checklist",
        content,
      },
      {} as any,
    )) as any;

    expect(result).toBeDefined();
    expect(result.id).toBe("new-page-id-12345");
    expect(result.url).toBe("https://www.notion.so/new-page-id-12345");

    // Inspect request body sent to Notion API
    expect(capturedRequestBody).toBeDefined();
    expect(capturedRequestBody.parent.page_id).toBe(
      "354ee125977100420e0adccb1497f850",
    );
    expect(capturedRequestBody.properties.title.title[0].text.content).toBe(
      "Executive Onboarding Checklist",
    );

    const children = capturedRequestBody.children;
    expect(children.length).toBeGreaterThan(4);

    // Verify Heading 1
    const h1 = children.find((b: any) => b.type === "heading_1");
    expect(h1).toBeDefined();
    expect(h1.heading_1.rich_text[0].text.content).toBe("Executive Onboarding");

    // Verify Heading 2
    const h2 = children.find((b: any) => b.type === "heading_2");
    expect(h2).toBeDefined();
    expect(h2.heading_2.rich_text[0].text.content).toBe("Week 1: Foundation");

    // Verify To-Do (unchecked)
    const todoUnchecked = children.find(
      (b: any) => b.type === "to_do" && b.to_do.checked === false,
    );
    expect(todoUnchecked).toBeDefined();
    expect(todoUnchecked.to_do.rich_text[0].text.content).toBe("Meet with CEO");

    // Verify To-Do (checked)
    const todoChecked = children.find(
      (b: any) => b.type === "to_do" && b.to_do.checked === true,
    );
    expect(todoChecked).toBeDefined();
    expect(todoChecked.to_do.rich_text[0].text.content).toBe(
      "Review security policies",
    );

    // CRITICAL: Verify that NO text block exceeds 2000 characters
    for (const block of children) {
      const type = block.type;
      const richText = block[type]?.rich_text;
      if (richText && richText.length > 0) {
        for (const rt of richText) {
          expect(rt.text.content.length).toBeLessThanOrEqual(2000);
        }
      }
    }
  });
});
