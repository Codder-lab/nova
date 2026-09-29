import { Server as HttpServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { env } from "../config/env";
import { logger } from "../utils/logger";
import { AgentSocketEvents, AgentStreamEvent } from "@nova/shared";

export class SocketService {
  private static instance: SocketService;
  private io: SocketIOServer | null = null;

  private constructor() {}

  public static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  public initialize(server: HttpServer): SocketIOServer {
    const allowedOrigins =
      env.NODE_ENV === "development"
        ? [env.CLIENT_URL, "http://localhost:5173", "http://localhost:3000"]
        : [env.CLIENT_URL];

    this.io = new SocketIOServer(server, {
      cors: {
        origin: allowedOrigins,
        credentials: true,
      },
    });

    this.io.on("connection", (socket: Socket) => {
      logger.info({ socketId: socket.id }, "Socket.IO client connected");

      // Join room by userId
      socket.on("join:user", (userId: string) => {
        if (userId) {
          socket.join(`user:${userId}`);
          logger.debug(
            { socketId: socket.id, userId },
            "Client joined user room",
          );
        }
      });

      // Join room by runId
      socket.on("join:run", (runId: string) => {
        if (runId) {
          socket.join(`run:${runId}`);
          logger.debug(
            { socketId: socket.id, runId },
            "Client joined run room",
          );
        }
      });

      socket.on("disconnect", () => {
        logger.debug({ socketId: socket.id }, "Socket.IO client disconnected");
      });
    });

    logger.info("Socket.IO server initialized successfully.");
    return this.io;
  }

  public getIO(): SocketIOServer | null {
    return this.io;
  }

  public emitEvent<T>(
    userId: string,
    runId: string,
    eventName: string,
    payload: T,
  ): void {
    if (!this.io) return;

    const event: AgentStreamEvent<T> = {
      runId,
      userId,
      type: eventName,
      timestamp: new Date().toISOString(),
      payload,
    };

    // Emit to both user room and run room
    this.io.to(`user:${userId}`).to(`run:${runId}`).emit(eventName, event);
  }

  public emitRunStarted(userId: string, runId: string, goal: string): void {
    this.emitEvent(userId, runId, AgentSocketEvents.RUN_STARTED, { goal });
  }

  public emitStep(userId: string, runId: string, step: unknown): void {
    this.emitEvent(userId, runId, AgentSocketEvents.RUN_STEP, step);
  }

  public emitToolCall(userId: string, runId: string, toolCall: unknown): void {
    this.emitEvent(userId, runId, AgentSocketEvents.RUN_TOOL_CALL, toolCall);
  }

  public emitCompleted(userId: string, runId: string, result: unknown): void {
    this.emitEvent(userId, runId, AgentSocketEvents.RUN_COMPLETED, result);
  }

  public emitFailed(userId: string, runId: string, error: string): void {
    this.emitEvent(userId, runId, AgentSocketEvents.RUN_FAILED, { error });
  }

  public emitToken(userId: string, runId: string, token: string): void {
    this.emitEvent(userId, runId, AgentSocketEvents.RUN_TOKEN, { token });
  }
}

export const socketService = SocketService.getInstance();
