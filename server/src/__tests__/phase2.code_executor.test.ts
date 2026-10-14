import { describe, it, expect } from "vitest";
import { executeCodeTool } from "../tools/code/code-executor.tool";
import { ToolContext } from "../tools/base/agent-tool.interface";

const mockContext: ToolContext = {
  userId: "user_test",
  runId: "run_test",
};

describe("Phase 2 — Code Execution Engine (executeCodeTool)", () => {
  it("should have correct tool metadata and HIGH risk level for human approval", () => {
    expect(executeCodeTool.name).toBe("execute_code");
    expect(executeCodeTool.riskLevel).toBe("HIGH");
    expect(executeCodeTool.description).toContain("sandboxed");
  });

  describe("JavaScript Execution (Node VM Sandbox)", () => {
    it("should evaluate JS expressions and return the evaluated result", async () => {
      const output = await executeCodeTool.execute(
        {
          language: "javascript",
          code: "const fib = (n) => n <= 1 ? n : fib(n - 1) + fib(n - 2); fib(7);",
        },
        mockContext,
      );

      expect(output.success).toBe(true);
      expect(output.language).toBe("javascript");
      expect(output.result).toBe(13);
      expect(output.exitCode).toBe(0);
      expect(output.executionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it("should capture console.log and console.warn into stdout and stderr", async () => {
      const output = await executeCodeTool.execute(
        {
          language: "javascript",
          code: `
            console.log("Hello Nova Sandbox!");
            console.log("Result:", 42);
            console.warn("Notice: Warning message");
          `,
        },
        mockContext,
      );

      expect(output.success).toBe(true);
      expect(output.stdout).toContain("Hello Nova Sandbox!");
      expect(output.stdout).toContain("Result: 42");
      expect(output.stderr).toContain("Notice: Warning message");
    });

    it("should catch syntax errors cleanly", async () => {
      const output = await executeCodeTool.execute(
        {
          language: "javascript",
          code: "const x = ;",
        },
        mockContext,
      );

      expect(output.success).toBe(false);
      expect(output.error).toBeDefined();
      expect(output.exitCode).toBe(1);
    });

    it("should enforce execution timeout for infinite loops", async () => {
      const output = await executeCodeTool.execute(
        {
          language: "javascript",
          code: "while(true) {}",
          timeoutMs: 1000,
        },
        mockContext,
      );

      expect(output.success).toBe(false);
      expect(output.error).toContain("timed out");
      expect(output.executionTimeMs).toBeGreaterThanOrEqual(900);
    });

    it("should prevent access to dangerous Node.js globals (process, require)", async () => {
      const output = await executeCodeTool.execute(
        {
          language: "javascript",
          code: "typeof process === 'undefined' && typeof require === 'undefined'",
        },
        mockContext,
      );

      expect(output.success).toBe(true);
      expect(output.result).toBe(true);
    });
  });

  describe("Python Execution (Isolated Subprocess)", () => {
    it("should execute Python scripts and capture stdout", async () => {
      const output = await executeCodeTool.execute(
        {
          language: "python",
          code: 'print("Hello from Python!")\nx = 10 * 5\nprint(f"Calculated: {x}")',
        },
        mockContext,
      );

      expect(output.success).toBe(true);
      expect(output.language).toBe("python");
      expect(output.stdout).toContain("Hello from Python!");
      expect(output.stdout).toContain("Calculated: 50");
      expect(output.exitCode).toBe(0);
    });

    it("should capture Python exceptions in stderr", async () => {
      const output = await executeCodeTool.execute(
        {
          language: "python",
          code: "1 / 0",
        },
        mockContext,
      );

      expect(output.success).toBe(false);
      expect(output.stderr).toContain("ZeroDivisionError");
      expect(output.exitCode).not.toBe(0);
    });

    it("should enforce execution timeout for runaway Python processes", async () => {
      const output = await executeCodeTool.execute(
        {
          language: "python",
          code: "import time\ntime.sleep(10)",
          timeoutMs: 1200,
        },
        mockContext,
      );

      expect(output.success).toBe(false);
      expect(output.error).toContain("timed out");
      expect(output.executionTimeMs).toBeGreaterThanOrEqual(1000);
    });
  });
});
