import fs from "fs/promises";
import path from "path";
import { z } from "zod";
import { AgentTool, ToolContext } from "../base/agent-tool.interface";

const WORKSPACE_BASE_DIR = path.resolve(process.cwd(), "workspaces");

async function resolveSafeUserPath(
  userId: string,
  relativePath: string,
): Promise<{ userDir: string; targetPath: string }> {
  const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const userDir = path.resolve(WORKSPACE_BASE_DIR, safeUserId);
  await fs.mkdir(userDir, { recursive: true });

  const targetPath = path.resolve(userDir, relativePath || ".");
  const normalizedTarget = path.normalize(targetPath);
  const normalizedUserDir = path.normalize(userDir);

  if (!normalizedTarget.startsWith(normalizedUserDir)) {
    throw new Error(
      "Access denied: Path traverses outside of permitted user workspace.",
    );
  }

  return { userDir, targetPath: normalizedTarget };
}

export const listFilesTool: AgentTool = {
  name: "list_files",
  description: "Lists files and folders in the user workspace.",
  riskLevel: "READ",
  inputSchema: z.object({
    directoryPath: z
      .string()
      .optional()
      .default(".")
      .describe("Relative path within the workspace to list"),
  }),
  async execute(input, context: ToolContext) {
    const userId = context.userId || "anonymous";
    const { targetPath } = await resolveSafeUserPath(
      userId,
      input.directoryPath || ".",
    );

    try {
      const entries = await fs.readdir(targetPath, { withFileTypes: true });
      const items = entries.map((entry) => ({
        name: entry.name,
        type: entry.isDirectory() ? "directory" : "file",
      }));

      return {
        path: input.directoryPath || ".",
        count: items.length,
        items,
      };
    } catch (err: any) {
      return {
        error: `Could not list directory: ${err.message}`,
      };
    }
  },
};

export const readFileTool: AgentTool = {
  name: "read_file",
  description: "Reads the text content of a file from the user workspace.",
  riskLevel: "READ",
  inputSchema: z.object({
    filePath: z.string().min(1).describe("Relative path to the file to read"),
  }),
  async execute(input, context: ToolContext) {
    const userId = context.userId || "anonymous";
    const { targetPath } = await resolveSafeUserPath(userId, input.filePath);

    try {
      const stats = await fs.stat(targetPath);
      if (stats.size > 1024 * 1024) {
        return {
          error: `File exceeds maximum allowed size (1MB). File size: ${stats.size} bytes.`,
        };
      }

      const content = await fs.readFile(targetPath, "utf-8");
      return {
        success: true,
        filePath: input.filePath,
        sizeBytes: stats.size,
        content,
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Failed to read file: ${err.message}`,
      };
    }
  },
};

export const createFileTool: AgentTool = {
  name: "create_file",
  description:
    "Creates or overwrites a text file with content in the user workspace.",
  riskLevel: "LOW",
  inputSchema: z.object({
    filePath: z.string().min(1).describe("Relative path to the file to create"),
    content: z.string().describe("The content to write into the file"),
  }),
  async execute(input, context: ToolContext) {
    const userId = context.userId || "anonymous";
    const { targetPath } = await resolveSafeUserPath(userId, input.filePath);

    try {
      if (input.content.length > 1024 * 1024) {
        return {
          error: "Content exceeds maximum allowed size (1MB).",
        };
      }

      const parentDir = path.dirname(targetPath);
      await fs.mkdir(parentDir, { recursive: true });
      await fs.writeFile(targetPath, input.content, "utf-8");

      return {
        success: true,
        message: `File "${input.filePath}" created successfully.`,
        filePath: input.filePath,
        sizeBytes: Buffer.byteLength(input.content, "utf-8"),
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Failed to create file: ${err.message}`,
      };
    }
  },
};
