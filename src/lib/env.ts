import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.url(),
  AUTH_SECRET: z.string().min(32),
  APP_URL: z.url(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const parsed = envSchema.safeParse({
  DATABASE_URL: process.env.DATABASE_URL,
  AUTH_SECRET: process.env.AUTH_SECRET,
  APP_URL: process.env.APP_URL,
  NODE_ENV: process.env.NODE_ENV,
});

export const env = parsed.success
  ? parsed.data
  : {
      DATABASE_URL: "",
      AUTH_SECRET: "",
      APP_URL: "http://localhost:2500",
      NODE_ENV: process.env.NODE_ENV ?? "development",
    };

export function hasValidEnv() {
  return parsed.success;
}

export function getEnvIssues() {
  return parsed.success ? [] : parsed.error.issues.map((issue) => issue.path.join("."));
}
