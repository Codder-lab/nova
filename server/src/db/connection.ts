import mongoose from "mongoose";
import { env } from "../config/env";
import { logger } from "../utils/logger";

let memoryServer: any = null;

function maskMongoUri(uri: string): string {
  try {
    return uri.replace(/(mongodb(?:\+srv)?:\/\/[^:]+:)([^@]+)(@)/, "$1****$3");
  } catch {
    return "***";
  }
}

export async function connectDB(): Promise<void> {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  const primaryUri = env.MONGODB_URI;
  const isAtlas =
    primaryUri.startsWith("mongodb+srv://") ||
    primaryUri.includes("mongodb.net");

  try {
    logger.info(
      { uri: maskMongoUri(primaryUri), isAtlas },
      "Connecting to MongoDB...",
    );
    await mongoose.connect(primaryUri, {
      serverSelectionTimeoutMS: 5000,
    });
    logger.info(" Connected to MongoDB successfully.");
  } catch (error: any) {
    logger.warn(
      { error: error.message, isAtlas },
      "Could not connect to external MongoDB.",
    );

    if (isAtlas) {
      logger.warn(
        "MongoDB Atlas connection failed. Please ensure: " +
          "1) Your current IP is whitelisted in Atlas Network Access, " +
          "2) Your DB username/password in MONGODB_URI are correct, " +
          "3) The database name is specified in the connection string.",
      );
    }

    if (env.NODE_ENV !== "production") {
      logger.info(
        "Starting fallback MongoMemoryServer for development/testing...",
      );
      try {
        const { MongoMemoryServer } = await import("mongodb-memory-server");
        memoryServer = await MongoMemoryServer.create();
        const memoryUri = memoryServer.getUri();
        await mongoose.connect(memoryUri);
        logger.info({ memoryUri }, " Connected to in-memory MongoDB fallback.");
      } catch (memErr: any) {
        logger.error(
          { err: memErr.message },
          "Failed to start MongoMemoryServer.",
        );
        throw memErr;
      }
    } else {
      throw error;
    }
  }
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
  logger.info("Disconnected from MongoDB.");
}
