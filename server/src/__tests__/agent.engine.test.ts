import { describe, it, expect, beforeEach } from 'vitest';
import { AgentEngine } from '../agents/agent.engine';
import { ToolRegistry } from '../tools/base/tool-registry';
import { calculateTool } from '../tools/system/calculate.tool';
import { getCurrentTimeTool } from '../tools/system/datetime.tool';
import { LLMProvider } from '../llm/provider';
import { LLMRequest, LLMResponse, LLMChunk } from '@nova/shared';

class MockLLMProvider implements LLMProvider {
  public name = 'mock-llm';
  public responses: LLMResponse[] = [];
  public callHistory: LLMRequest[] = [];

  constructor(responses: LLMResponse[] = []) {
    this.responses = responses;
  }

  public supportsToolCalling(): boolean {
    return true;
  }

  public async generate(request: LLMRequest): Promise<LLMResponse> {
    this.callHistory.push(request);
    const next = this.responses.shift();
    if (!next) {
      return { content: 'Default mock answer' };
    }
    return next;
  }

  public async *stream(_request: LLMRequest): AsyncIterable<LLMChunk> {
    yield { contentChunk: 'mock', isDone: true };
  }
}

describe('AgentEngine', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
    registry.register(calculateTool);
    registry.register(getCurrentTimeTool);
  });

  it('answers directly when no tools are required', async () => {
    const mockLLM = new MockLLMProvider([
      { content: 'Hello! How can I assist you today?' },
    ]);

    const engine = new AgentEngine({ llm: mockLLM, tools: registry });
    const result = await engine.run({
      userId: 'user-1',
      goal: 'Hi there!',
    });

    expect(result.status).toBe('completed');
    expect(result.response).toBe('Hello! How can I assist you today?');
    expect(result.toolCallsCount).toBe(0);
    expect(result.steps.length).toBe(2); // planning + response
    expect(result.steps[0].type).toBe('planning');
    expect(result.steps[1].type).toBe('response');
  });

  it('orchestrates a full tool calling loop and observation', async () => {
    const mockLLM = new MockLLMProvider([
      // First turn: LLM decides to call calculate
      {
        content: '',
        toolCalls: [
          {
            id: 'call_1',
            name: 'calculate',
            arguments: { expression: '128 * 4' },
          },
        ],
      },
      // Second turn: LLM synthesizes answer from observation
      {
        content: '128 multiplied by 4 equals 512.',
      },
    ]);

    const engine = new AgentEngine({ llm: mockLLM, tools: registry });
    const result = await engine.run({
      userId: 'user-1',
      goal: 'What is 128 * 4?',
    });

    expect(result.status).toBe('completed');
    expect(result.response).toBe('128 multiplied by 4 equals 512.');
    expect(result.toolCallsCount).toBe(1);

    // Verify step sequence: planning -> tool execution -> response
    expect(result.steps).toHaveLength(3);
    expect(result.steps[0].type).toBe('planning');
    expect(result.steps[1].type).toBe('tool');
    expect(result.steps[1].toolCall?.name).toBe('calculate');
    expect(result.steps[1].toolCall?.status).toBe('completed');
    expect(result.steps[1].toolCall?.result).toEqual({
      expression: '128 * 4',
      result: 512,
      formatted: '128 * 4 = 512',
    });
    expect(result.steps[2].type).toBe('response');
  });

  it('handles unknown tool calls gracefully and reports observation back', async () => {
    const mockLLM = new MockLLMProvider([
      {
        content: '',
        toolCalls: [
          {
            id: 'call_invalid',
            name: 'non_existent_tool',
            arguments: { foo: 'bar' },
          },
        ],
      },
      {
        content: 'I apologize, that tool is not available.',
      },
    ]);

    const engine = new AgentEngine({ llm: mockLLM, tools: registry });
    const result = await engine.run({
      userId: 'user-1',
      goal: 'Do something impossible',
    });

    expect(result.status).toBe('completed');
    expect(result.steps[1].toolCall?.status).toBe('failed');
    expect(result.response).toBe('I apologize, that tool is not available.');
  });

  it('respects maxSteps safeguard to prevent infinite loops', async () => {
    // LLM keeps calling tool indefinitely
    const endlessResponses: LLMResponse[] = Array.from({ length: 15 }, (_, i) => ({
      content: '',
      toolCalls: [
        {
          id: `call_${i}`,
          name: 'calculate',
          arguments: { expression: `${i} + 1` },
        },
      ],
    }));

    const mockLLM = new MockLLMProvider(endlessResponses);
    const engine = new AgentEngine({ llm: mockLLM, tools: registry });

    const result = await engine.run({
      userId: 'user-1',
      goal: 'Count forever',
      maxSteps: 3,
    });

    expect(result.status).toBe('failed');
    expect(result.response).toMatch(/maximum allowed LLM calls/);
  });
});
