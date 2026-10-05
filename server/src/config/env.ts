import dotenv from "dotenv";
import path from "path";
import { z } from "zod";

// Load .env file
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.string().transform(Number).default("5000"),
  CLIENT_URL: z.string().default("http://localhost:5173"),

  // Database
  MONGODB_URI: z.string().default("mongodb://localhost:27017/nova"),

  // Security
  JWT_SECRET: z
    .string()
    .min(16, "JWT_SECRET must be at least 16 characters")
    .default("supersecret_nova_jwt_dev_key_at_least_32_chars!"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  BETTER_AUTH_SECRET: z.string().optional(),

  // LLM Provider
  LLM_PROVIDER: z
    .enum(["ollama", "openrouter"])
    .default("ollama"),
  OPENROUTER_API_KEY: z.string().optional(),
  OLLAMA_BASE_URL: z.string().url().default("http://localhost:11434"),
  OLLAMA_MODEL: z.string().default("qwen2.5:7b"),

  // Agent Safeguards
  MAX_AGENT_STEPS: z.string().transform(Number).default("10"),
  MAX_EXECUTION_TIME_MS: z.string().transform(Number).default("60000"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "❌ Invalid environment variables:",
    JSON.stringify(parsed.error.format(), null, 2),
  );
  process.exit(1);
}

export const env = parsed.data;
