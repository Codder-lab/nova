import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { bearer } from "better-auth/plugins";
import mongoose from "mongoose";
import { env } from "../config/env";
import { logger } from "../utils/logger";

// Dynamic proxy to access mongoose database connection instance
const dbProxy = new Proxy({} as any, {
  get(_target, prop) {
    const activeDb = mongoose.connection.db;
    if (!activeDb) {
      throw new Error("MongoDB database is not connected yet.");
    }
    const val = (activeDb as any)[prop];
    return typeof val === "function" ? val.bind(activeDb) : val;
  },
});

export const auth = betterAuth({
  baseURL: env.CLIENT_URL || "http://localhost:5173",
  basePath: "/api/auth",
  secret:
    env.BETTER_AUTH_SECRET ||
    process.env.BETTER_AUTH_SECRET ||
    env.JWT_SECRET ||
    "nova-better-auth-secret-key-development-2026-secure",
  database: mongodbAdapter(dbProxy),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 6,
  },
  plugins: [bearer()],
  trustedOrigins: [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:5000",
    env.CLIENT_URL,
  ].filter(Boolean),
  logger: {
    disabled: false,
    verbose: env.NODE_ENV === "development",
  },
});

logger.info("Better Auth initialized successfully.");
