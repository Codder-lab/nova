import { v4 as uuidv4 } from 'uuid';
import {
  AgentInput,
  AgentResult,
  AgentStep,
  ChatMessage,
  ToolCallRecord,
} from '@nova/shared';
import { LLMProvider } from '../llm/provider';
import { getLLMProvider } from '../llm';
import { ToolRegistry, globalToolRegistry } from '../tools/base/tool-registry';
import { ToolContext } from '../tools/base/agent-tool.interface';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export class AgentEngine {
  private llm: LLMProvider;
  private tools: ToolRegistry;

  constructor(options?: { llm?: LLMProvider; tools?: ToolRegistry }) {
    this.llm = options?.llm || getLLMProvider();
    this.tools = options?.tools || globalToolRegistry;
  }

  /**
   * Builds the system prompt dynamically from the registered tools.
   * No tool names are ever hard-coded in the engine — extensible by design.
   */
  private buildSystemPrompt(): string {
    const availableTools = this.tools.getAll();
    const toolSummary = availableTools
      .map((t) => `  - "${t.name}" [risk: ${t.riskLevel}]: ${t.description}`)
      .join('\n');

    return `You are Nova, an intelligent, general-purpose agentic AI assistant.
Your goal is to help the user by understanding their intent and taking the necessary actions.

You have access to the following tools. Call them whenever needed to produce a correct, factual answer:
${toolSummary}

Rules:
- Use tools to retrieve real data (current time, calculations, web content, tasks, etc.) instead of guessing.
- After receiving tool results, compose a clear and concise final response using those results.
- If no tool is needed (greetings, opinions, creative tasks), answer directly without calling tools.
- Do not expose your internal reasoning or tool call mechanics to the user.`;
  }

  /**
   * Run the agent loop for a given user goal.
   * maxSteps controls the maximum number of LLM inference calls (not total recorded steps).
   */
  public async run(input: AgentInput): Promise<AgentResult> {
    const runId = input.runId || uuidv4();
    const startTime = Date.now();
    const maxLLMCalls = input.maxSteps ?? env.MAX_AGENT_STEPS;
    const timeoutMs = input.timeoutMs ?? env.MAX_EXECUTION_TIME_MS;

    const steps: AgentStep[] = [];
    let toolCallsCount = 0;
    let finalResponse = '';
    let llmCallCount = 0;
    let isFinished = false;

    logger.info({ runId, goal: input.goal, userId: input.userId }, 'Starting Agent execution run');

    // Planning step — recorded before any LLM inference, does not count against maxLLMCalls
    steps.push({
      id: uuidv4(),
      stepNumber: 1,
      type: 'planning',
      title: 'Understanding request and planning execution',
      description: `Analyzing user goal: "${input.goal}"`,
      status: 'completed',
      startedAt: new Date(),
      completedAt: new Date(),
    });

    const toolDefinitions = this.tools.toToolDefinitions();
    const toolContext: ToolContext = {
      userId: input.userId,
      conversationId: input.conversationId,
      runId,
    };

    const messages: ChatMessage[] = [
      { role: 'system', content: this.buildSystemPrompt() },
      { role: 'user', content: input.goal },
    ];

    while (!isFinished && llmCallCount < maxLLMCalls) {
      // Timeout guard
      if (Date.now() - startTime > timeoutMs) {
        logger.warn({ runId, durationMs: Date.now() - startTime }, 'Agent run timed out');
        finalResponse = 'The request timed out before completing all steps.';
        break;
      }

      llmCallCount++;
      const stepNumber = steps.length + 1;

      logger.debug(
        { runId, llmCallCount, maxLLMCalls, messagesCount: messages.length },
        'Requesting next action from LLM'
      );

      let llmResponse;
      try {
        llmResponse = await this.llm.generate({
          messages,
          tools: toolDefinitions,
          temperature: 0.1,
        });
      } catch (err: any) {
        logger.error({ runId, err: err.message }, 'LLM generation failed');
        return {
          runId,
          status: 'failed',
          goal: input.goal,
          response: `Failed during LLM inference: ${err.message}`,
          steps,
          toolCallsCount,
          durationMs: Date.now() - startTime,
          error: err.message,
        };
      }

      if (llmResponse.toolCalls && llmResponse.toolCalls.length > 0) {
        // Record assistant message with its tool call intent
        messages.push({
          role: 'assistant',
          content: llmResponse.content || '',
          toolCalls: llmResponse.toolCalls,
        });

        for (const tc of llmResponse.toolCalls) {
          toolCallsCount++;
          const tool = this.tools.get(tc.name);

          const toolRecord: ToolCallRecord = {
            id: tc.id || uuidv4(),
            name: tc.name,
            arguments: tc.arguments,
            status: 'executing',
          };

          const step: AgentStep = {
            id: uuidv4(),
            stepNumber,
            type: 'tool',
            title: `Executing tool: ${tc.name}`,
            description: `Calling "${tc.name}" with arguments: ${JSON.stringify(tc.arguments)}`,
            toolCall: toolRecord,
            status: 'running',
            startedAt: new Date(),
          };
          steps.push(step);

          if (!tool) {
            const errStr = `Tool "${tc.name}" is not registered or unavailable.`;
            logger.warn({ runId, tool: tc.name }, errStr);
            toolRecord.status = 'failed';
            toolRecord.error = errStr;
            step.status = 'failed';
            step.completedAt = new Date();
            messages.push({
              role: 'tool',
              name: tc.name,
              content: JSON.stringify({ error: errStr }),
              toolCallId: tc.id,
            });
            continue;
          }

          // Validate tool input against its Zod schema
          const validation = tool.inputSchema.safeParse(tc.arguments);
          if (!validation.success) {
            const valErr = `Invalid arguments for tool "${tc.name}": ${JSON.stringify(validation.error.format())}`;
            logger.warn({ runId, tool: tc.name, error: valErr }, 'Tool argument validation failed');
            toolRecord.status = 'failed';
            toolRecord.error = valErr;
            step.status = 'failed';
            step.completedAt = new Date();
            messages.push({
              role: 'tool',
              name: tc.name,
              content: JSON.stringify({ error: valErr }),
              toolCallId: tc.id,
            });
            continue;
          }

          // Execute tool
          const toolStart = Date.now();
          try {
            logger.info({ runId, tool: tc.name, args: validation.data }, 'Executing tool');
            const result = await tool.execute(validation.data, toolContext);
            const toolDuration = Date.now() - toolStart;

            toolRecord.result = result;
            toolRecord.durationMs = toolDuration;
            toolRecord.status = 'completed';
            step.status = 'completed';
            step.completedAt = new Date();

            logger.info({ runId, tool: tc.name, toolDuration }, 'Tool execution completed');

            messages.push({
              role: 'tool',
              name: tc.name,
              content: typeof result === 'string' ? result : JSON.stringify(result),
              toolCallId: tc.id,
            });
          } catch (execErr: any) {
            const toolDuration = Date.now() - toolStart;
            logger.error({ runId, tool: tc.name, err: execErr.message }, 'Tool execution threw error');

            toolRecord.error = execErr.message;
            toolRecord.durationMs = toolDuration;
            toolRecord.status = 'failed';
            step.status = 'failed';
            step.completedAt = new Date();

            messages.push({
              role: 'tool',
              name: tc.name,
              content: JSON.stringify({ error: execErr.message }),
              toolCallId: tc.id,
            });
          }
        }
      } else {
        // No tool calls — LLM has produced its final answer
        finalResponse = llmResponse.content.trim();
        isFinished = true;

        steps.push({
          id: uuidv4(),
          stepNumber,
          type: 'response',
          title: 'Final response formulated',
          description: finalResponse,
          status: 'completed',
          startedAt: new Date(),
          completedAt: new Date(),
        });
      }
    }

    const wasExhausted = !isFinished;
    if (wasExhausted && !finalResponse) {
      finalResponse = `Agent reached the maximum allowed LLM calls (${maxLLMCalls}) without completing the task.`;
    }

    const durationMs = Date.now() - startTime;
    logger.info(
      { runId, durationMs, toolCallsCount, llmCallCount, stepsCount: steps.length },
      'Agent run completed'
    );

    return {
      runId,
      // Use 'failed' when maxSteps was exhausted so consumers can distinguish clean vs. cutoff
      status: wasExhausted ? 'failed' : 'completed',
      goal: input.goal,
      response: finalResponse,
      steps,
      toolCallsCount,
      durationMs,
    };
  }
}
