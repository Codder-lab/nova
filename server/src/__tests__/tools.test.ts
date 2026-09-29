import { describe, it, expect, beforeEach } from 'vitest';
import { calculateTool } from '../tools/system/calculate.tool';
import { getCurrentTimeTool } from '../tools/system/datetime.tool';
import { ToolRegistry } from '../tools/base/tool-registry';

describe('System Tools', () => {
  const dummyContext = { userId: 'test-user-123' };

  describe('calculateTool', () => {
    it('evaluates basic arithmetic correctly', async () => {
      const result = await calculateTool.execute({ expression: '15 * 12' }, dummyContext);
      expect(result.result).toBe(180);
      expect(result.expression).toBe('15 * 12');
    });

    it('evaluates complex expressions with functions', async () => {
      const result = await calculateTool.execute({ expression: 'sqrt(144) + 2^4' }, dummyContext);
      expect(result.result).toBe(28); // 12 + 16
    });

    it('throws a descriptive error on invalid mathematical syntax', async () => {
      await expect(
        calculateTool.execute({ expression: 'invalid ++ math %%' }, dummyContext)
      ).rejects.toThrow(/Calculation error/);
    });
  });

  describe('getCurrentTimeTool', () => {
    it('returns current time metadata', async () => {
      const result = await getCurrentTimeTool.execute({}, dummyContext);
      expect(result).toHaveProperty('iso');
      expect(result).toHaveProperty('formatted');
      expect(result).toHaveProperty('dayOfWeek');
      expect(result).toHaveProperty('timezone');
      expect(result.timestampMs).toBeGreaterThan(0);
    });

    it('formats time with specified timezone', async () => {
      const result = await getCurrentTimeTool.execute({ timezone: 'UTC' }, dummyContext);
      expect(result.timezone).toBe('UTC');
      expect(result.formatted).toBeDefined();
    });
  });

  describe('ToolRegistry', () => {
    let registry: ToolRegistry;

    beforeEach(() => {
      registry = new ToolRegistry();
    });

    it('registers and retrieves tools by name', () => {
      registry.register(calculateTool);
      expect(registry.has('calculate')).toBe(true);
      expect(registry.get('calculate')).toBe(calculateTool);
    });

    it('converts registered tools to LLM ToolDefinitions', () => {
      registry.register(calculateTool);
      registry.register(getCurrentTimeTool);

      const defs = registry.toToolDefinitions();
      expect(defs).toHaveLength(2);
      expect(defs[0].name).toBe('calculate');
      expect(defs[0].parameters.type).toBe('object');
      expect(defs[0].parameters.properties).toHaveProperty('expression');
    });
  });
});
