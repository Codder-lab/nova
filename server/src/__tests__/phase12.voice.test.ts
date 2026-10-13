import { describe, it, expect } from "vitest";
import {
  DEFAULT_VOICE_CONFIG,
  sanitizeForSpeech,
  type VoiceConfig,
} from "@nova/shared";

describe("Phase 12: Voice Interface & Speech Utilities", () => {
  describe("1. Voice Configuration & Defaults", () => {
    it("should provide valid default voice configuration", () => {
      expect(DEFAULT_VOICE_CONFIG).toBeDefined();
      expect(DEFAULT_VOICE_CONFIG.enabled).toBe(true);
      expect(DEFAULT_VOICE_CONFIG.lang).toBe("en-US");
      expect(DEFAULT_VOICE_CONFIG.pitch).toBe(1.0);
      expect(DEFAULT_VOICE_CONFIG.rate).toBe(1.0);
      expect(DEFAULT_VOICE_CONFIG.volume).toBe(1.0);
      expect(DEFAULT_VOICE_CONFIG.autoSpeak).toBe(false);
      expect(DEFAULT_VOICE_CONFIG.handsFree).toBe(false);
      expect(DEFAULT_VOICE_CONFIG.pushToTalk).toBe(true);
      expect(DEFAULT_VOICE_CONFIG.soundCues).toBe(true);
    });

    it("should support updating custom voice parameters", () => {
      const custom: VoiceConfig = {
        ...DEFAULT_VOICE_CONFIG,
        pitch: 1.2,
        rate: 1.1,
        volume: 0.9,
        autoSpeak: true,
        handsFree: true,
      };

      expect(custom.pitch).toBe(1.2);
      expect(custom.rate).toBe(1.1);
      expect(custom.autoSpeak).toBe(true);
      expect(custom.handsFree).toBe(true);
    });
  });

  describe("2. Speech Sanitizer (Markdown to Conversational Audio)", () => {
    it("should handle empty or null values gracefully", () => {
      expect(sanitizeForSpeech("")).toBe("");
      expect(sanitizeForSpeech(null as any)).toBe("");
      expect(sanitizeForSpeech(undefined as any)).toBe("");
    });

    it("should remove multiline fenced code blocks", () => {
      const input = `Here is the solution:
\`\`\`typescript
const greeting = "Hello world";
console.log(greeting);
\`\`\`
Let me know if you need more help.`;

      const output = sanitizeForSpeech(input);
      expect(output).not.toContain("const greeting");
      expect(output).not.toContain("console.log");
      expect(output).toContain("Code block omitted.");
      expect(output).toContain("Here is the solution");
    });

    it("should preserve inline code text while removing backticks", () => {
      const input = "You can run `npm run dev` to launch the server on `port 3000`.";
      const output = sanitizeForSpeech(input);
      expect(output).toBe("You can run npm run dev to launch the server on port 3000.");
      expect(output).not.toContain("`");
    });

    it("should convert markdown links to readable anchor text", () => {
      const input = "Check the [Official Documentation](https://vitejs.dev/guide) for more.";
      const output = sanitizeForSpeech(input);
      expect(output).toBe("Check the Official Documentation for more.");
      expect(output).not.toContain("https://");
    });

    it("should replace raw URLs with verbal placeholders", () => {
      const input = "Visit https://google.com or http://example.org/test for details.";
      const output = sanitizeForSpeech(input);
      expect(output).toBe("Visit the link or the link for details.");
      expect(output).not.toContain("https://");
    });

    it("should strip markdown headings, bullet lists, bold and italic symbols", () => {
      const input = `### Deployment Steps
* First **build** the application
* Then *deploy* to production
* Lastly, verify server status`;

      const output = sanitizeForSpeech(input);
      expect(output).not.toContain("#");
      expect(output).not.toContain("*");
      expect(output).toContain("Deployment Steps");
      expect(output).toContain("First build the application");
      expect(output).toContain("Then deploy to production");
    });

    it("should normalize multiple newlines into pauses and spaces", () => {
      const input = "First sentence.\n\n\nSecond sentence.\nThird sentence.";
      const output = sanitizeForSpeech(input);
      expect(output).toBe("First sentence. Second sentence. Third sentence.");
    });

    it("should strip blockquotes and horizontal rules", () => {
      const input = `> Note: Important security advisory.
---
Everything is operational.`;

      const output = sanitizeForSpeech(input);
      expect(output).not.toContain(">");
      expect(output).not.toContain("---");
      expect(output).toContain("Note: Important security advisory.");
      expect(output).toContain("Everything is operational.");
    });
  });
});
