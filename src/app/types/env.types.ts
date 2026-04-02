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
  AZURE_OPENAI_ENDPOINT: string;
  AZURE_OPENAI_API_KEY: string;
  AZURE_OPENAI_MODEL: string;
  AZURE_OPENAI_DEPLOYMENT?: string;
  AZURE_OPENAI_API_VERSION: string;
  RESEND_API_KEY: string;
  EMAIL_FROM: string;
}
