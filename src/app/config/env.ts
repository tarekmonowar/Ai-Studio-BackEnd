import "dotenv/config";
import { z } from "zod";
import { INTERVIEW_PREP_INSTRUCTION } from "../utils/voiceInstructions.js";
import type { AppEnv } from "../types/env.types.js";

export type {
  AppEnv,
  InstructionMode,
  SpeakerProfile,
} from "../types/env.types.js";

function parseBooleanEnv(value: unknown, defaultValue: boolean): boolean {
  if (typeof value !== "string") {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return defaultValue;
  }

  if (["true", "1", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no", "off"].includes(normalized)) {
    return false;
  }

  return defaultValue;
}

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8787),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  VOICELIVE_ENDPOINT: z.string().min(1, "VOICELIVE_ENDPOINT is required"),
  VOICELIVE_API_KEY: z.string().min(1, "VOICELIVE_API_KEY is required"),
  VOICELIVE_MODEL: z.string().default("gpt-realtime"),
  VOICELIVE_INSTRUCTIONS: z.string().default(INTERVIEW_PREP_INSTRUCTION),
  RATE_LIMIT_ENABLED: z
    .unknown()
    .transform((value) => parseBooleanEnv(value, true)),
  RATE_LIMIT_MINUTES: z.coerce.number().positive().default(15),
});

export const env: AppEnv = envSchema.parse(process.env);
