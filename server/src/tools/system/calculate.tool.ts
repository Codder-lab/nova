import { z } from "zod";
import { evaluate } from "mathjs";
import { AgentTool, ToolContext } from "../base/agent-tool.interface";

export const calculateSchema = z.object({
  expression: z
    .string()
    .min(1, "Mathematical expression is required")
    .describe(
      'Mathematical expression to evaluate (e.g., "15 * 12", "sqrt(144) + 10", "2^8", "round(100 / 3, 2)")',
    ),
});

export type CalculateInput = z.infer<typeof calculateSchema>;

export interface CalculateOutput {
  expression: string;
  result: number | string;
  formatted: string;
}

export const calculateTool: AgentTool<CalculateInput, CalculateOutput> = {
  name: "calculate",
  description:
    "Safely evaluate mathematical and arithmetic expressions. Use whenever calculations, percentages, or number conversions are required.",
  riskLevel: "READ",
  inputSchema: calculateSchema,

  async execute(
    input: CalculateInput,
    _context: ToolContext,
  ): Promise<CalculateOutput> {
    try {
      const sanitized = input.expression.trim();
      const rawResult = evaluate(sanitized);

      let result: number | string;
      if (typeof rawResult === "object" && rawResult !== null) {
        result = rawResult.toString();
      } else {
        result = rawResult;
      }

      return {
        expression: input.expression,
        result,
        formatted: `${input.expression} = ${result}`,
      };
    } catch (error: any) {
      throw new Error(
        `Calculation error for expression "${input.expression}": ${error.message}`,
      );
    }
  },
};
