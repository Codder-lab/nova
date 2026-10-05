import { describe, it, expect, beforeEach, afterEach } from "vitest";
import http from "http";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { createApp } from "../app";
import { analyticsService } from "../services/analytics.service";
import { AgentRunModel } from "../models/agent-run.model";
import { Memory } from "../models/memory.model";
import { Task } from "../models/task.model";

describe("Phase 13: Analytics & Observability Engine", () => {
  let mongoServer: MongoMemoryServer;
  let server: http.Server;
  let baseUrl: string;

  beforeEach(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    const app = createApp();
    server = app.listen(0);
    const address = server.address() as any;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  describe("1. Token Pricing & Cost Calculation", () => {
    it("should compute $0.00 for local Ollama / Qwen models", () => {
      const cost = analyticsService.calculateCost("qwen2.5:7b", 100000, 50000);
      expect(cost).toBe(0);
    });

    it("should compute correct costs for GPT-4o", () => {
      // 1M prompt ($2.50) + 1M completion ($10.00) = $12.50
      const cost = analyticsService.calculateCost("gpt-4o", 1_000_000, 1_000_000);
      expect(cost).toBe(12.5);
    });

    it("should compute correct costs for Claude 3.5 Sonnet", () => {
      // 500k prompt ($1.50) + 200k completion ($3.00) = $4.50
      const cost = analyticsService.calculateCost(
        "claude-3-5-sonnet",
        500_000,
        200_000
      );
      expect(cost).toBe(4.5);
    });

    it("should compute correct costs for Gemini 2.0 Flash", () => {
      // 1M prompt ($0.10) + 1M completion ($0.40) = $0.50
      const cost = analyticsService.calculateCost(
        "gemini-2.0-flash",
        1_000_000,
        1_000_000
      );
      expect(cost).toBe(0.5);
    });
  });

  describe("2. Overview Aggregations & Metrics", () => {
    beforeEach(async () => {
      const now = new Date();

      // Seed 3 agent runs
      await AgentRunModel.create([
        {
          runId: "run-1",
          userId: "user-analytics",
          goal: "Search web for docs",
          status: "completed",
          provider: "openai",
          model: "gpt-4o",
          toolCallsCount: 2,
          durationMs: 1200,
          promptTokens: 500,
          completionTokens: 200,
          totalTokens: 700,
          startedAt: now,
          completedAt: now,
          createdAt: now,
          steps: [
            {
              id: "s1",
              stepNumber: 1,
              type: "planning",
              title: "Plan",
              status: "completed",
              startedAt: now,
            },
            {
              id: "s2",
              stepNumber: 2,
              type: "tool",
              title: "Web Search",
              status: "completed",
              startedAt: now,
              toolCall: {
                id: "tc1",
                name: "web_search",
                durationMs: 400,
                status: "completed",
              },
            },
          ],
        },
        {
          runId: "run-2",
          userId: "user-analytics",
          goal: "Calculate stats",
          status: "completed",
          provider: "ollama",
          model: "qwen2.5:7b",
          toolCallsCount: 1,
          durationMs: 800,
          promptTokens: 300,
          completionTokens: 100,
          totalTokens: 400,
          startedAt: now,
          completedAt: now,
          createdAt: now,
          steps: [
            {
              id: "s3",
              stepNumber: 1,
              type: "tool",
              title: "Calc",
              status: "completed",
              startedAt: now,
              toolCall: {
                id: "tc2",
                name: "calculate",
                durationMs: 50,
                status: "completed",
              },
            },
          ],
        },
        {
          runId: "run-3",
          userId: "user-analytics",
          goal: "Failing action",
          status: "failed",
          provider: "openai",
          model: "gpt-4o",
          toolCallsCount: 1,
          durationMs: 600,
          promptTokens: 200,
          completionTokens: 50,
          totalTokens: 250,
          startedAt: now,
          completedAt: now,
          createdAt: now,
          steps: [
            {
              id: "s4",
              stepNumber: 1,
              type: "tool",
              title: "Failed search",
              status: "failed",
              startedAt: now,
              toolCall: {
                id: "tc3",
                name: "web_search",
                durationMs: 500,
                status: "failed",
                error: "Network timeout",
              },
            },
          ],
        },
      ]);

      // Seed Memory and Tasks
      await Memory.create({
        userId: "user-analytics",
        content: "Prefers concise responses",
        category: "preference",
      });
      await Task.create({
        userId: "user-analytics",
        title: "Test task",
        status: "todo",
      });
    });

    it("should calculate accurate overview statistics", async () => {
      const overview = await analyticsService.getOverview("user-analytics", "7d");

      expect(overview.totalRuns).toBe(3);
      expect(overview.completedRuns).toBe(2);
      expect(overview.failedRuns).toBe(1);
      expect(overview.successRate).toBe(66.7); // 2/3 = 66.7%
      expect(overview.totalTokens).toBe(1350);
      expect(overview.promptTokens).toBe(1000);
      expect(overview.completionTokens).toBe(350);
      expect(overview.totalToolCalls).toBe(4);
      expect(overview.avgRunDurationMs).toBe(Math.round((1200 + 800 + 600) / 3));
      expect(overview.totalMemories).toBe(1);
      expect(overview.totalTasks).toBe(1);
      expect(overview.estimatedCostUsd).toBeGreaterThan(0);
    });

    it("should aggregate timeline time-series", async () => {
      const timeline = await analyticsService.getTimeline("user-analytics", "7d");
      expect(timeline.length).toBeGreaterThanOrEqual(1);

      const todayPoint = timeline[0];
      expect(todayPoint.runs).toBe(3);
      expect(todayPoint.totalTokens).toBe(1350);
    });

    it("should group model usage breakdown", async () => {
      const models = await analyticsService.getModelStats("user-analytics", "7d");
      expect(models.length).toBe(2);

      const gpt4o = models.find((m) => m.model === "gpt-4o");
      expect(gpt4o).toBeDefined();
      expect(gpt4o?.runsCount).toBe(2);
      expect(gpt4o?.percentage).toBe(66.7);

      const qwen = models.find((m) => m.model === "qwen2.5:7b");
      expect(qwen).toBeDefined();
      expect(qwen?.runsCount).toBe(1);
      expect(qwen?.estimatedCostUsd).toBe(0);
    });

    it("should profile tool latency and error rates", async () => {
      const tools = await analyticsService.getToolStats("user-analytics", "7d");
      expect(tools.length).toBe(2); // web_search and calculate

      const webSearch = tools.find((t) => t.name === "web_search");
      expect(webSearch).toBeDefined();
      expect(webSearch?.totalCalls).toBe(2);
      expect(webSearch?.successCalls).toBe(1);
      expect(webSearch?.failedCalls).toBe(1);
      expect(webSearch?.successRate).toBe(50);
      expect(webSearch?.avgDurationMs).toBe(450); // (400 + 500) / 2
      expect(webSearch?.minDurationMs).toBe(400);
      expect(webSearch?.maxDurationMs).toBe(500);

      const calculate = tools.find((t) => t.name === "calculate");
      expect(calculate?.successRate).toBe(100);
    });

    it("should compute goal complexity distribution", async () => {
      const complexity = await analyticsService.getComplexitySummary(
        "user-analytics",
        "7d"
      );
      expect(complexity.buckets.length).toBe(4);
      expect(complexity.p50DurationMs).toBeGreaterThan(0);
      expect(complexity.avgStepsPerRun).toBeGreaterThan(0);
    });

    it("should generate CSV export string", async () => {
      const csv = await analyticsService.exportReportCsv("user-analytics", "7d");
      expect(csv).toContain("RunId,CreatedAt,Status,Goal,Model");
      expect(csv).toContain("run-1");
      expect(csv).toContain("run-2");
      expect(csv).toContain("run-3");
    });
  });

  describe("3. REST API Endpoints", () => {
    it("GET /api/analytics/overview should return 200 with summary", async () => {
      const res = await fetch(`${baseUrl}/api/analytics/overview?range=7d`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.overview).toBeDefined();
      expect(typeof data.overview.totalRuns).toBe("number");
    });

    it("GET /api/analytics/timeline should return time-series", async () => {
      const res = await fetch(`${baseUrl}/api/analytics/timeline?range=7d`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.timeline)).toBe(true);
    });

    it("GET /api/analytics/models should return model distribution", async () => {
      const res = await fetch(`${baseUrl}/api/analytics/models?range=7d`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.models)).toBe(true);
    });

    it("GET /api/analytics/tools should return tool heatmap stats", async () => {
      const res = await fetch(`${baseUrl}/api/analytics/tools?range=7d`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.tools)).toBe(true);
    });

    it("GET /api/analytics/complexity should return complexity stats", async () => {
      const res = await fetch(`${baseUrl}/api/analytics/complexity?range=7d`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.complexity.buckets).toBeDefined();
    });

    it("GET /api/analytics/export should download CSV attachment", async () => {
      const res = await fetch(`${baseUrl}/api/analytics/export?range=7d`);
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain("RunId,CreatedAt,Status");
      expect(res.headers.get("content-type")).toContain("text/csv");
    });
  });
});
