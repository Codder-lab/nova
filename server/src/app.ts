import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { env } from "./config/env";
import { authRouter } from "./routes/auth.routes";
import { agentRouter } from "./routes/agent.routes";
import { logger } from "./utils/logger";

import taskRoutes from "./routes/task.routes";
import reminderRoutes from "./routes/reminder.routes";
import memoryRoutes from "./routes/memory.routes";
import scheduleRoutes from "./routes/schedule.routes";
import conversationRoutes from "./routes/conversation.routes";
import { modelRouter } from "./routes/model.routes";

export function createApp(): express.Application {
  const app = express();

  // CORS: In development accept any localhost origin for convenience.
  // In production, restrict to CLIENT_URL only.
  const allowedOrigins =
    env.NODE_ENV === "development"
      ? [env.CLIENT_URL, "http://localhost:5173", "http://localhost:3000"]
      : [env.CLIENT_URL];

  app.use(
    cors({
      origin: (origin, cb) => {
        // Allow non-browser requests (curl, Postman, server-to-server) and allowed origins
        if (!origin || allowedOrigins.includes(origin)) {
          cb(null, true);
        } else {
          cb(new Error(`CORS policy: origin ${origin} not allowed`));
        }
      },
      credentials: true,
    }),
  );
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health check
  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({
      status: "ok",
      service: "nova-assistant-api",
      timestamp: new Date().toISOString(),
      llmProvider: env.LLM_PROVIDER,
      model: env.OLLAMA_MODEL,
    });
  });

  // API Routes
  app.use("/api/auth", authRouter);
  app.use("/api/agent", agentRouter);
  app.use("/api/tasks", taskRoutes);
  app.use("/api/reminders", reminderRoutes);
  app.use("/api/memories", memoryRoutes);
  app.use("/api/schedules", scheduleRoutes);
  app.use("/api/conversations", conversationRoutes);
  app.use("/api/sessions", conversationRoutes);
  app.use("/api/models", modelRouter);

  // 404 Handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "Endpoint not found" });
  });

  // Global Error Handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    logger.error({ err: err.message, stack: err.stack }, "Unhandled API error");
    res
      .status(500)
      .json({ error: "Internal server error", message: err.message });
  });

  return app;
}
