import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";
import {
  AgentInput,
  AgentResult,
  AgentStep,
  ChatMessage,
  ToolCallRecord,
  PendingApprovalAction,
  AgentSocketEvents,
} from "@nova/shared";
import { LLMProvider } from "../llm/provider";
import { getLLMProvider } from "../llm";
import { ToolRegistry, globalToolRegistry } from "../tools/base/tool-registry";
import { ToolContext } from "../tools/base/agent-tool.interface";
import { AgentRunModel } from "../models/agent-run.model";
import { memoryService } from "../services/memory.service";
import { socketService } from "../services/socket.service";
import { permissionEngine } from "./agent.permissions";
import { browserManager } from "../tools/browser/browser.manager";
import { env } from "../config/env";
import { logger } from "../utils/logger";

export class AgentEngine {
  private llm: LLMProvider;
  private tools: ToolRegistry;

  constructor(options?: { llm?: LLMProvider; tools?: ToolRegistry }) {
    this.llm = options?.llm || getLLMProvider();
    this.tools = options?.tools || globalToolRegistry;
  }

  /**
   * Builds the system prompt dynamically from the registered tools,
   * injecting relevant semantic memory context when available.
   */
  private buildSystemPrompt(memoryContext = ""): string {
    const availableTools = this.tools.getAll();
    const toolSummary = availableTools
      .map((t) => `  - "${t.name}" [risk: ${t.riskLevel}]: ${t.description}`)
      .join("\n");

    return `You are Nova, an intelligent, general-purpose agentic AI assistant.
Your goal is to help the user by understanding their intent and taking the necessary actions.
${memoryContext}
You have access to the following tools. Call them whenever needed to produce a correct, factual answer:
${toolSummary}

Rules:
- Use tools to retrieve real data (current time, calculations, web content, tasks, memories, files, schedules, browser automation) instead of guessing.
- After receiving tool results, compose a clear and concise final response using those results.
- If no tool is needed (greetings, opinions, creative tasks), answer directly without calling tools.
- Do not expose your internal reasoning or tool call mechanics to the user.`;
  }

  /**
   * Run the agent loop for a given user goal.
   * Enforces the Permission Engine: high-risk actions suspend execution for human approval.
   */
  public async run(input: AgentInput): Promise<AgentResult> {
    const runId = input.runId || uuidv4();
    const startTime = Date.now();
    const maxLLMCalls = input.maxSteps ?? env.MAX_AGENT_STEPS;
    const timeoutMs = input.timeoutMs ?? env.MAX_EXECUTION_TIME_MS;
    const isDbConnected = mongoose.connection.readyState === 1;

    const steps: AgentStep[] = [];
    let toolCallsCount = 0;
    let finalResponse = "";
    let llmCallCount = 0;
    let isFinished = false;

    logger.info(
      { runId, goal: input.goal, userId: input.userId },
      "Starting Agent execution run",
    );

    // 1. Retrieve relevant Semantic Memory
    let memoryContext = "";
    if (isDbConnected) {
      try {
        memoryContext = await memoryService.buildMemoryContext(
          input.userId,
          input.goal,
        );
      } catch (memErr: any) {
        logger.warn(
          { error: memErr.message },
          "Failed retrieving memory context",
        );
      }
    }

    // 2. Initial Planning Step
    const initialStep: AgentStep = {
      id: uuidv4(),
      stepNumber: 1,
      type: "planning",
      title: "Understanding request and planning execution",
      description: `Analyzing user goal: "${input.goal}"`,
      status: "completed",
      startedAt: new Date(),
      completedAt: new Date(),
    };
    steps.push(initialStep);

    // 3. Persist Initial Run & Broadcast Started Event
    if (isDbConnected) {
      try {
        await AgentRunModel.create({
          runId,
          userId: input.userId,
          conversationId: input.conversationId,
          goal: input.goal,
          status: "running",
          steps: [initialStep],
          startedAt: new Date(),
          metadata: input.metadata || {},
        });
      } catch (dbErr: any) {
        logger.warn(
          { error: dbErr.message },
          "Failed to persist initial AgentRun",
        );
      }
    }

    socketService.emitRunStarted(input.userId, runId, input.goal);
    socketService.emitStep(input.userId, runId, initialStep);

    const toolDefinitions = this.tools.toToolDefinitions();
    const toolContext: ToolContext = {
      userId: input.userId,
      conversationId: input.conversationId,
      runId,
    };

    const messages: ChatMessage[] = [
      { role: "system", content: this.buildSystemPrompt(memoryContext) },
      { role: "user", content: input.goal },
    ];

    while (!isFinished && llmCallCount < maxLLMCalls) {
      // Timeout guard
      if (Date.now() - startTime > timeoutMs) {
        logger.warn(
          { runId, durationMs: Date.now() - startTime },
          "Agent run timed out",
        );
        finalResponse = "The request timed out before completing all steps.";
        break;
      }

      llmCallCount++;
      const stepNumber = steps.length + 1;

      logger.debug(
        { runId, llmCallCount, maxLLMCalls, messagesCount: messages.length },
        "Requesting next action from LLM",
      );

      let llmResponse;
      try {
        llmResponse = await this.llm.generate({
          messages,
          tools: toolDefinitions,
          temperature: 0.1,
        });
      } catch (err: any) {
        logger.error({ runId, err: err.message }, "LLM generation failed");
        const errorResult: AgentResult = {
          runId,
          status: "failed",
          goal: input.goal,
          response: `Failed during LLM inference: ${err.message}`,
          steps,
          toolCallsCount,
          durationMs: Date.now() - startTime,
          error: err.message,
        };

        if (isDbConnected) {
          await AgentRunModel.updateOne(
            { runId },
            {
              $set: {
                status: "failed",
                error: err.message,
                completedAt: new Date(),
                durationMs: errorResult.durationMs,
              },
            },
          ).catch(() => {});
        }
        socketService.emitFailed(input.userId, runId, err.message);
        return errorResult;
      }

      if (llmResponse.toolCalls && llmResponse.toolCalls.length > 0) {
        messages.push({
          role: "assistant",
          content: llmResponse.content || "",
          toolCalls: llmResponse.toolCalls,
        });

        for (const tc of llmResponse.toolCalls) {
          toolCallsCount++;
          const tool = this.tools.get(tc.name);

          const toolRecord: ToolCallRecord = {
            id: tc.id || uuidv4(),
            name: tc.name,
            arguments: tc.arguments,
            status: "executing",
          };

          const step: AgentStep = {
            id: uuidv4(),
            stepNumber,
            type: "tool",
            title: `Executing tool: ${tc.name}`,
            description: `Calling "${tc.name}" with arguments: ${JSON.stringify(tc.arguments)}`,
            toolCall: toolRecord,
            status: "running",
            startedAt: new Date(),
          };
          steps.push(step);
          socketService.emitStep(input.userId, runId, step);

          if (!tool) {
            const errStr = `Tool "${tc.name}" is not registered or unavailable.`;
            logger.warn({ runId, tool: tc.name }, errStr);
            toolRecord.status = "failed";
            toolRecord.error = errStr;
            step.status = "failed";
            step.completedAt = new Date();
            messages.push({
              role: "tool",
              name: tc.name,
              content: JSON.stringify({ error: errStr }),
              toolCallId: tc.id,
            });
            socketService.emitToolCall(input.userId, runId, toolRecord);
            continue;
          }

          // Validate tool input against its Zod schema
          const validation = tool.inputSchema.safeParse(tc.arguments);
          if (!validation.success) {
            const valErr = `Invalid arguments for tool "${tc.name}": ${JSON.stringify(validation.error.format())}`;
            logger.warn(
              { runId, tool: tc.name, error: valErr },
              "Tool argument validation failed",
            );
            toolRecord.status = "failed";
            toolRecord.error = valErr;
            step.status = "failed";
            step.completedAt = new Date();
            messages.push({
              role: "tool",
              name: tc.name,
              content: JSON.stringify({ error: valErr }),
              toolCallId: tc.id,
            });
            socketService.emitToolCall(input.userId, runId, toolRecord);
            continue;
          }

          // 4. PERMISSION ENGINE EVALUATION (Human-in-the-Loop)
          const requiresApproval = permissionEngine.requiresApproval(
            tool.name,
            tool.riskLevel,
          );
          if (requiresApproval) {
            const explanation = permissionEngine.getRiskExplanation(
              tool.name,
              tool.riskLevel,
              validation.data,
            );
            const pendingAction: PendingApprovalAction = {
              id: uuidv4(),
              toolName: tc.name,
              arguments: validation.data,
              riskLevel: tool.riskLevel,
              explanation,
              requestedAt: new Date(),
            };

            step.status = "pending";
            toolRecord.status = "pending";

            logger.warn(
              { runId, tool: tc.name, riskLevel: tool.riskLevel },
              "Action requires human approval",
            );

            if (isDbConnected) {
              await AgentRunModel.updateOne(
                { runId },
                {
                  $set: {
                    status: "waiting_for_approval",
                    pendingApproval: pendingAction,
                    steps,
                    toolCallsCount,
                    durationMs: Date.now() - startTime,
                    "metadata.suspendedMessages": messages,
                    "metadata.pendingToolCall": tc,
                    "metadata.toolContext": toolContext,
                  },
                },
              ).catch(() => {});
            }

            socketService.emitEvent(
              input.userId,
              runId,
              AgentSocketEvents.APPROVAL_REQUIRED,
              pendingAction,
            );

            return {
              runId,
              status: "waiting_for_approval",
              goal: input.goal,
              response: `Action "${tc.name}" requires your authorization before proceeding: ${explanation}`,
              steps,
              toolCallsCount,
              durationMs: Date.now() - startTime,
              pendingApproval: pendingAction,
            };
          }

          // Execute tool directly if auto-approved
          const toolStart = Date.now();
          try {
            logger.info(
              { runId, tool: tc.name, args: validation.data },
              "Executing tool",
            );
            const result = await tool.execute(validation.data, toolContext);
            const toolDuration = Date.now() - toolStart;

            toolRecord.result = result;
            toolRecord.durationMs = toolDuration;
            toolRecord.status = "completed";
            step.status = "completed";
            step.completedAt = new Date();

            logger.info(
              { runId, tool: tc.name, toolDuration },
              "Tool execution completed",
            );

            messages.push({
              role: "tool",
              name: tc.name,
              content:
                typeof result === "string" ? result : JSON.stringify(result),
              toolCallId: tc.id,
            });
            socketService.emitToolCall(input.userId, runId, toolRecord);
          } catch (execErr: any) {
            const toolDuration = Date.now() - toolStart;
            logger.error(
              { runId, tool: tc.name, err: execErr.message },
              "Tool execution threw error",
            );

            toolRecord.error = execErr.message;
            toolRecord.durationMs = toolDuration;
            toolRecord.status = "failed";
            step.status = "failed";
            step.completedAt = new Date();

            messages.push({
              role: "tool",
              name: tc.name,
              content: JSON.stringify({ error: execErr.message }),
              toolCallId: tc.id,
            });
            socketService.emitToolCall(input.userId, runId, toolRecord);
          }

          // Persist progress to DB
          if (isDbConnected) {
            AgentRunModel.updateOne(
              { runId },
              {
                $set: {
                  steps,
                  toolCallsCount,
                  durationMs: Date.now() - startTime,
                },
              },
            ).catch(() => {});
          }
        }
      } else {
        // No tool calls — LLM produced final answer
        finalResponse = llmResponse.content.trim();
        isFinished = true;

        const responseStep: AgentStep = {
          id: uuidv4(),
          stepNumber,
          type: "response",
          title: "Final response formulated",
          description: finalResponse,
          status: "completed",
          startedAt: new Date(),
          completedAt: new Date(),
        };
        steps.push(responseStep);
        socketService.emitStep(input.userId, runId, responseStep);
      }
    }

    const wasExhausted = !isFinished;
    if (wasExhausted && !finalResponse) {
      finalResponse = `Agent reached the maximum allowed LLM calls (${maxLLMCalls}) without completing the task.`;
    }

    const durationMs = Date.now() - startTime;
    const finalStatus = wasExhausted ? "failed" : "completed";

    logger.info(
      {
        runId,
        durationMs,
        toolCallsCount,
        llmCallCount,
        stepsCount: steps.length,
        status: finalStatus,
      },
      "Agent run completed",
    );

    // Finalize run in MongoDB Atlas
    if (isDbConnected) {
      await AgentRunModel.updateOne(
        { runId },
        {
          $set: {
            status: finalStatus,
            finalResponse,
            steps,
            toolCallsCount,
            durationMs,
            completedAt: new Date(),
          },
        },
      ).catch((err) =>
        logger.warn({ error: err.message }, "Failed finalizing AgentRun in DB"),
      );
    }

    const result: AgentResult = {
      runId,
      status: finalStatus,
      goal: input.goal,
      response: finalResponse,
      steps,
      toolCallsCount,
      durationMs,
    };

    if (finalStatus === "completed") {
      socketService.emitCompleted(input.userId, runId, result);
    } else {
      socketService.emitFailed(input.userId, runId, finalResponse);
    }

    // Clean up browser session associated with this run if one was opened
    browserManager.closeSession(runId).catch(() => {});

    return result;
  }

  /**
   * Resumes a run that is in 'waiting_for_approval' status after human approval or rejection.
   */
  public async resume(runId: string, approved: boolean): Promise<AgentResult> {
    const runDoc = await AgentRunModel.findOne({ runId });
    if (!runDoc || runDoc.status !== "waiting_for_approval") {
      throw new Error(`Run "${runId}" is not waiting for approval.`);
    }

    const pending = runDoc.pendingApproval;
    if (!pending) {
      throw new Error(`No pending action found for run "${runId}".`);
    }

    const messages =
      (runDoc.metadata?.suspendedMessages as ChatMessage[]) || [];
    const pendingTc = runDoc.metadata?.pendingToolCall as any;
    const toolContext = (runDoc.metadata?.toolContext as ToolContext) || {
      userId: runDoc.userId,
      runId: runDoc.runId,
    };

    const steps = runDoc.steps;
    const lastStep = steps[steps.length - 1];

    if (!approved) {
      // Rejection: tool was denied by user
      if (lastStep && lastStep.toolCall) {
        lastStep.status = "failed";
        lastStep.toolCall.status = "failed";
        lastStep.toolCall.error = "User denied authorization for this action.";
        lastStep.completedAt = new Date();
      }

      messages.push({
        role: "tool",
        name: pending.toolName,
        content: JSON.stringify({
          error: "User denied authorization to execute this action.",
        }),
        toolCallId: pendingTc?.id,
      });

      // Let LLM formulate a response acknowledging cancellation
      const toolDefinitions = this.tools.toToolDefinitions();
      const llmResponse = await this.llm.generate({
        messages,
        tools: toolDefinitions,
        temperature: 0.1,
      });

      const finalResponse =
        llmResponse.content.trim() ||
        "Action was denied by user authorization.";
      steps.push({
        id: uuidv4(),
        stepNumber: steps.length + 1,
        type: "response",
        title: "Action denied by user",
        description: finalResponse,
        status: "completed",
        startedAt: new Date(),
        completedAt: new Date(),
      });

      await AgentRunModel.updateOne(
        { runId },
        {
          $set: {
            status: "completed",
            finalResponse,
            steps,
            completedAt: new Date(),
            pendingApproval: null,
          },
        },
      );

      socketService.emitEvent(
        runDoc.userId,
        runId,
        AgentSocketEvents.APPROVAL_RESOLVED,
        {
          runId,
          approved: false,
        },
      );

      return {
        runId,
        status: "completed",
        goal: runDoc.goal,
        response: finalResponse,
        steps,
        toolCallsCount: runDoc.toolCallsCount,
        durationMs: runDoc.durationMs,
      };
    }

    // Approval: execute the approved tool!
    const tool = this.tools.get(pending.toolName);
    if (!tool) {
      throw new Error(`Tool "${pending.toolName}" is no longer available.`);
    }

    try {
      const result = await tool.execute(pending.arguments, toolContext);
      if (lastStep && lastStep.toolCall) {
        lastStep.status = "completed";
        lastStep.toolCall.status = "completed";
        lastStep.toolCall.result = result;
        lastStep.completedAt = new Date();
      }

      messages.push({
        role: "tool",
        name: pending.toolName,
        content: typeof result === "string" ? result : JSON.stringify(result),
        toolCallId: pendingTc?.id,
      });
    } catch (err: any) {
      if (lastStep && lastStep.toolCall) {
        lastStep.status = "failed";
        lastStep.toolCall.status = "failed";
        lastStep.toolCall.error = err.message;
        lastStep.completedAt = new Date();
      }
      messages.push({
        role: "tool",
        name: pending.toolName,
        content: JSON.stringify({ error: err.message }),
        toolCallId: pendingTc?.id,
      });
    }

    // Continue LLM to formulate completion
    const toolDefinitions = this.tools.toToolDefinitions();
    const llmResponse = await this.llm.generate({
      messages,
      tools: toolDefinitions,
      temperature: 0.1,
    });

    const finalResponse = llmResponse.content.trim();
    steps.push({
      id: uuidv4(),
      stepNumber: steps.length + 1,
      type: "response",
      title: "Action authorized and completed",
      description: finalResponse,
      status: "completed",
      startedAt: new Date(),
      completedAt: new Date(),
    });

    await AgentRunModel.updateOne(
      { runId },
      {
        $set: {
          status: "completed",
          finalResponse,
          steps,
          completedAt: new Date(),
          pendingApproval: null,
        },
      },
    );

    socketService.emitEvent(
      runDoc.userId,
      runId,
      AgentSocketEvents.APPROVAL_RESOLVED,
      {
        runId,
        approved: true,
      },
    );
    socketService.emitCompleted(runDoc.userId, runId, { finalResponse, steps });

    browserManager.closeSession(runId).catch(() => {});

    return {
      runId,
      status: "completed",
      goal: runDoc.goal,
      response: finalResponse,
      steps,
      toolCallsCount: runDoc.toolCallsCount,
      durationMs: runDoc.durationMs,
    };
  }
}
