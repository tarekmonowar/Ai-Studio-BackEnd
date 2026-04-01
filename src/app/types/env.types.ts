export type InstructionMode = "interview-prep" | "english-learning";

export type SpeakerProfile = "monowar" | "muntaha";

export interface AppEnv {
  PORT: number;
  CORS_ORIGIN: string;
  VOICELIVE_ENDPOINT: string;
  VOICELIVE_API_KEY: string;
  VOICELIVE_MODEL: string;
  VOICELIVE_INSTRUCTIONS: string;
  RATE_LIMIT_ENABLED: boolean;
  RATE_LIMIT_MINUTES: number;
}
