import { AgentTool } from "./agent-tool.interface";
import { ToolDefinition } from "@nova/shared";
import { zodToToolDefinition } from "./zod-to-json";
import { logger } from "../../utils/logger";

export class ToolRegistry {
  private tools: Map<string, AgentTool> = new Map();

  /**
   * Register a new tool into the registry
   */
  public register(tool: AgentTool): void {
    if (this.tools.has(tool.name)) {
      logger.warn(
        { tool: tool.name },
        "Overwriting existing tool registration",
      );
    }
    this.tools.set(tool.name, tool);
    logger.debug(
      { tool: tool.name, risk: tool.riskLevel },
      "Tool registered successfully",
    );
  }

  /**
   * Retrieve a tool by its unique name
   */
  public get(name: string): AgentTool | undefined {
    const cleanName = name.replace(/^(default_api|tools|functions):/, "");
    return this.tools.get(name) || this.tools.get(cleanName);
  }

  /**
   * Check if a tool exists
   */
  public has(name: string): boolean {
    const cleanName = name.replace(/^(default_api|tools|functions):/, "");
    return this.tools.has(name) || this.tools.has(cleanName);
  }

  /**
   * Get all registered tools
   */
  public getAll(): AgentTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get all available tools for a given context (can be filtered by permissions/roles in later phases)
   */
  public getAvailableTools(_context?: any): AgentTool[] {
    return this.getAll();
  }

  /**
   * Export all registered tools as LLM tool definitions
   */
  public toToolDefinitions(): ToolDefinition[] {
    return this.getAll().map((tool) =>
      zodToToolDefinition(tool.name, tool.description, tool.inputSchema),
    );
  }
}

// Global default tool registry singleton
export const globalToolRegistry = new ToolRegistry();
