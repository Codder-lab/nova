import { createApp } from './app';
import { env } from './config/env';
import { connectDB, disconnectDB } from './db/connection';
import { initializeDefaultTools } from './tools';
import { logger } from './utils/logger';

async function bootstrap() {
  try {
    // 1. Initialize default tools
    initializeDefaultTools();
    logger.info('System tools initialized successfully.');

    // 2. Connect to Database (with memory-server fallback in dev)
    await connectDB();

    // 3. Start Express server
    const app = createApp();
    const server = app.listen(env.PORT, () => {
      logger.info(` Nova AI Server running on port ${env.PORT} (${env.NODE_ENV})`);
      logger.info(` LLM Provider configured: ${env.LLM_PROVIDER} (${env.OLLAMA_MODEL})`);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Shutting down gracefully...`);
      server.close(async () => {
        await disconnectDB();
        logger.info('Server closed. Process exiting.');
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error: any) {
    logger.error({ error: error.message, stack: error.stack }, 'Failed to start Nova server');
    process.exit(1);
  }
}

bootstrap();
