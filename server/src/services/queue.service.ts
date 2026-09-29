import { v4 as uuidv4 } from "uuid";
import { AgentEngine } from "../agents/agent.engine";
import { socketService } from "./socket.service";
import { logger } from "../utils/logger";

export interface BackgroundJob {
  id: string;
  userId: string;
  goal: string;
  conversationId?: string;
  metadata?: Record<string, unknown>;
  status: "queued" | "running" | "completed" | "failed";
  error?: string;
  createdAt: Date;
}

export class QueueService {
  private queue: BackgroundJob[] = [];
  private isProcessing = false;
  private concurrency = 2;
  private activeCount = 0;

  public enqueue(input: {
    userId: string;
    goal: string;
    conversationId?: string;
    metadata?: Record<string, unknown>;
  }): BackgroundJob {
    const job: BackgroundJob = {
      id: uuidv4(),
      userId: input.userId,
      goal: input.goal,
      conversationId: input.conversationId,
      metadata: input.metadata,
      status: "queued",
      createdAt: new Date(),
    };

    this.queue.push(job);
    logger.info(
      { jobId: job.id, userId: job.userId, goal: job.goal },
      "Enqueued background agent job",
    );
    socketService.emitEvent(job.userId, job.id, "job:queued", job);

    this.processNext();
    return job;
  }

  private async processNext(): Promise<void> {
    if (this.activeCount >= this.concurrency || this.queue.length === 0) {
      return;
    }

    const job = this.queue.shift();
    if (!job) return;

    this.activeCount++;
    job.status = "running";
    socketService.emitEvent(job.userId, job.id, "job:started", job);

    // Run agent in background
    (async () => {
      try {
        const engine = new AgentEngine();
        const result = await engine.run({
          runId: job.id,
          userId: job.userId,
          goal: job.goal,
          conversationId: job.conversationId,
          metadata: { ...job.metadata, source: "background_queue" },
        });

        job.status = result.status === "completed" ? "completed" : "failed";
        if (result.error) job.error = result.error;

        logger.info(
          { jobId: job.id, status: job.status },
          "Background agent job finished",
        );
        socketService.emitEvent(job.userId, job.id, "job:completed", {
          job,
          result,
        });
      } catch (err: any) {
        job.status = "failed";
        job.error = err.message;
        logger.error(
          { jobId: job.id, error: err.message },
          "Background agent job threw error",
        );
        socketService.emitEvent(job.userId, job.id, "job:failed", {
          job,
          error: err.message,
        });
      } finally {
        this.activeCount--;
        this.processNext();
      }
    })();

    // Check if more jobs can run in parallel
    this.processNext();
  }

  public getPendingCount(): number {
    return this.queue.length;
  }

  public getActiveCount(): number {
    return this.activeCount;
  }
}

export const queueService = new QueueService();
