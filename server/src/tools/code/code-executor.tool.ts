import { z } from "zod";
import * as vm from "node:vm";
import { spawn } from "node:child_process";
import { AgentTool, ToolContext } from "../base/agent-tool.interface";
import { logger } from "../../utils/logger";

export const codeExecutorSchema = z.object({
  language: z
    .enum(["javascript", "typescript", "python"])
    .describe("The programming language to execute ('javascript', 'typescript', or 'python')"),
  code: z
    .string()
    .min(1, "Code string cannot be empty")
    .max(50000, "Code exceeds maximum length of 50,000 characters")
    .describe("The source code to execute"),
  timeoutMs: z
    .number()
    .int()
    .min(500)
    .max(30000)
    .optional()
    .default(10000)
    .describe("Maximum execution time in milliseconds (default: 10000ms / 10s)"),
});

export type CodeExecutorInput = z.input<typeof codeExecutorSchema>;

export interface CodeExecutorOutput {
  success: boolean;
  language: "javascript" | "typescript" | "python";
  stdout: string;
  stderr: string;
  result?: unknown;
  exitCode?: number;
  executionTimeMs: number;
  error?: string;
}


const MAX_OUTPUT_BYTES = 50 * 1024; // 50 KB

/**
 * Truncates output to avoid memory exhaustion
 */
function truncateOutput(str: string): string {
  if (str.length <= MAX_OUTPUT_BYTES) return str;
  return str.slice(0, MAX_OUTPUT_BYTES) + `\n... [Output truncated: exceeded ${MAX_OUTPUT_BYTES / 1024} KB]`;
}

/**
 * Formats console arguments into human-readable strings
 */
function formatArgs(args: unknown[]): string {
  return args
    .map((arg) => {
      if (typeof arg === "string") return arg;
      if (typeof arg === "object" && arg !== null) {
        try {
          return JSON.stringify(arg, null, 2);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    })
    .join(" ");
}

/**
 * Executes JavaScript code safely in a node:vm context
 */
async function executeJavaScript(
  code: string,
  timeoutMs: number,
): Promise<Omit<CodeExecutorOutput, "language">> {
  const startTime = Date.now();
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];

  const customConsole = {
    log: (...args: unknown[]) => stdoutChunks.push(formatArgs(args)),
    info: (...args: unknown[]) => stdoutChunks.push(formatArgs(args)),
    warn: (...args: unknown[]) => stderrChunks.push(formatArgs(args)),
    error: (...args: unknown[]) => stderrChunks.push(formatArgs(args)),
    dir: (...args: unknown[]) => stdoutChunks.push(formatArgs(args)),
  };

  // Safe isolated sandbox
  const sandbox = {
    console: customConsole,
    Math,
    Date,
    JSON,
    RegExp,
    Array,
    Object,
    Number,
    String,
    Boolean,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    encodeURI,
    decodeURI,
    encodeURIComponent,
    decodeURIComponent,
    Set,
    Map,
    WeakSet,
    WeakMap,
    Promise,
    // Explicitly block dangerous globals
    process: undefined,
    require: undefined,
    module: undefined,
    global: undefined,
    globalThis: undefined,
  };

  const context = vm.createContext(sandbox);

  try {
    const script = new vm.Script(code, {
      filename: "sandbox.js",
    });

    const rawResult = script.runInContext(context, {
      timeout: timeoutMs,
      breakOnSigint: true,
      displayErrors: true,
    });

    let serializableResult: unknown = undefined;
    if (rawResult !== undefined) {
      try {
        serializableResult =
          typeof rawResult === "function"
            ? `[Function: ${rawResult.name || "anonymous"}]`
            : JSON.parse(JSON.stringify(rawResult));
      } catch {
        serializableResult = String(rawResult);
      }
    }

    const executionTimeMs = Date.now() - startTime;
    return {
      success: true,
      stdout: truncateOutput(stdoutChunks.join("\n")),
      stderr: truncateOutput(stderrChunks.join("\n")),
      result: serializableResult,
      exitCode: 0,
      executionTimeMs,
    };
  } catch (err: any) {
    const executionTimeMs = Date.now() - startTime;
    const isTimeout =
      err?.message?.includes("Script execution timed out") ||
      err?.code === "ERR_SCRIPT_EXECUTION_TIMEOUT";

    const errorMessage = isTimeout
      ? `Execution timed out after ${timeoutMs}ms`
      : err?.message || String(err);

    return {
      success: false,
      stdout: truncateOutput(stdoutChunks.join("\n")),
      stderr: truncateOutput(
        stderrChunks.length ? stderrChunks.join("\n") + "\n" + errorMessage : errorMessage,
      ),
      error: errorMessage,
      exitCode: 1,
      executionTimeMs,
    };
  }
}

/**
 * Executes Python code via an isolated subprocess with stripped environment
 */
async function executePython(
  code: string,
  timeoutMs: number,
): Promise<Omit<CodeExecutorOutput, "language">> {
  const startTime = Date.now();

  return new Promise((resolve) => {
    // Sanitized environment to prevent leaking secrets/tokens
    const safeEnv: NodeJS.ProcessEnv = {
      PATH: process.env.PATH || "",
      SYSTEMROOT: process.env.SYSTEMROOT || "",
      TEMP: process.env.TEMP || "",
      TMP: process.env.TMP || "",
      PYTHONIOENCODING: "utf-8",
    };

    let stdoutData = "";
    let stderrData = "";
    let isFinished = false;

    // Use -u for unbuffered binary stdout/stderr
    const pyProcess = spawn("python", ["-u", "-c", code], {
      env: safeEnv,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });

    const timer = setTimeout(() => {
      if (!isFinished) {
        isFinished = true;
        try {
          pyProcess.kill("SIGKILL");
        } catch {
          // Ignore
        }
        const executionTimeMs = Date.now() - startTime;
        resolve({
          success: false,
          stdout: truncateOutput(stdoutData),
          stderr: truncateOutput(
            (stderrData ? stderrData + "\n" : "") +
              `Execution timed out after ${timeoutMs}ms`,
          ),
          error: `Execution timed out after ${timeoutMs}ms`,
          exitCode: 124,
          executionTimeMs,
        });
      }
    }, timeoutMs);

    pyProcess.stdout.on("data", (chunk: Buffer) => {
      if (stdoutData.length < MAX_OUTPUT_BYTES) {
        stdoutData += chunk.toString("utf-8");
      }
    });

    pyProcess.stderr.on("data", (chunk: Buffer) => {
      if (stderrData.length < MAX_OUTPUT_BYTES) {
        stderrData += chunk.toString("utf-8");
      }
    });

    pyProcess.on("error", (err: Error) => {
      if (!isFinished) {
        isFinished = true;
        clearTimeout(timer);
        const executionTimeMs = Date.now() - startTime;
        resolve({
          success: false,
          stdout: truncateOutput(stdoutData),
          stderr: truncateOutput(err.message),
          error: `Failed to launch Python: ${err.message}`,
          exitCode: 1,
          executionTimeMs,
        });
      }
    });

    pyProcess.on("close", (exitCode: number | null) => {
      if (!isFinished) {
        isFinished = true;
        clearTimeout(timer);
        const executionTimeMs = Date.now() - startTime;
        const codeNum = exitCode ?? 0;
        resolve({
          success: codeNum === 0,
          stdout: truncateOutput(stdoutData.trimEnd()),
          stderr: truncateOutput(stderrData.trimEnd()),
          exitCode: codeNum,
          executionTimeMs,
          error: codeNum !== 0 ? stderrData.trim() || `Process exited with code ${codeNum}` : undefined,
        });
      }
    });
  });
}

export const executeCodeTool: AgentTool<CodeExecutorInput, CodeExecutorOutput> = {
  name: "execute_code",
  description:
    "Executes JavaScript, TypeScript, or Python code in a secure sandboxed environment. Returns stdout, stderr, execution duration, and evaluated results. Requires user approval prior to execution. ONLY invoke this tool when the user explicitly asks to RUN, EXECUTE, or TEST code. Do NOT use this tool if the user simply asks to write, show, generate, or provide code.",
  riskLevel: "HIGH",
  inputSchema: codeExecutorSchema as any,

  async execute(
    input: CodeExecutorInput,
    _context: ToolContext,
  ): Promise<CodeExecutorOutput> {
    const { language, code, timeoutMs = 10000 } = input;
    logger.info({ language, codeLength: code.length }, "Executing sandboxed code");

    let result: Omit<CodeExecutorOutput, "language">;

    if (language === "python") {
      result = await executePython(code, timeoutMs);
    } else {
      // JavaScript & TypeScript (treated as JS in VM)
      result = await executeJavaScript(code, timeoutMs);
    }

    return {
      language,
      ...result,
    };
  },
};
