import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import type { AppEnv } from "../../config/env.js";

export interface AnalyticalAiClients {
  openai: OpenAI;
  supabase: SupabaseClient;
  embeddingModel: string;
}

/**
 * Creates the OpenAI + Supabase clients needed for the embedding pipeline.
 * The OpenAI client reuses the existing Azure OpenAI configuration.
 * Supabase is configured from dedicated env vars.
 */
export function getAnalyticalAiClients(env: AppEnv): AnalyticalAiClients {
  const parsedEndpoint = new URL(env.AZURE_OPENAI_ENDPOINT.trim());
  const pathname = parsedEndpoint.pathname.toLowerCase().replace(/\/$/, "");
  const isV1 = pathname.endsWith("/openai/v1");

  let openaiClient: OpenAI;

  if (isV1) {
    openaiClient = new OpenAI({
      apiKey: env.AZURE_OPENAI_API_KEY,
      baseURL: parsedEndpoint.toString().replace(/\/$/, ""),
    });
  } else {
    parsedEndpoint.pathname = "";
    parsedEndpoint.search = "";
    parsedEndpoint.hash = "";
    const endpointRoot = parsedEndpoint.toString().replace(/\/$/, "");

    openaiClient = new OpenAI({
      apiKey: env.AZURE_OPENAI_API_KEY,
      baseURL: `${endpointRoot}/openai`,
      defaultQuery: { "api-version": env.AZURE_OPENAI_API_VERSION },
      defaultHeaders: { "api-key": env.AZURE_OPENAI_API_KEY },
    });
  }

  const supabaseClient = createClient(
    env.SUPABASE_URL,
    env.SUPABASE_API_KEY,
  );

  return {
    openai: openaiClient,
    supabase: supabaseClient,
    embeddingModel: env.AI_EMBEDDING_MODEL,
  };
}
