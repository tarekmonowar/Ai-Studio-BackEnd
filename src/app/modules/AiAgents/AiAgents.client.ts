import OpenAI, { AzureOpenAI } from "openai";
import type { AppEnv } from "../../config/env.js";

// The resolved AI client plus the model name to use for completions
export interface ResolvedAiClient {
  client: OpenAI | AzureOpenAI;
  model: string;
}

/**
 * Safely parses the Azure endpoint URL string.
 * Returns null if the URL is malformed or empty.
 */
function normalizeAzureEndpoint(endpoint: string): URL | null {
  const trimmed = endpoint.trim();
  try {
    return new URL(trimmed);
  } catch {
    return null;
  }
}

/**
 * Resolves the correct OpenAI or AzureOpenAI client based on the endpoint format.
 *
 * - If the endpoint path ends with /openai/v1, uses the standard OpenAI client
 *   (compatible with Azure AI Foundry serverless endpoints).
 * - Otherwise, uses the AzureOpenAI client with deployment-based routing.
 */
export function getOpenAIClient(env: AppEnv): ResolvedAiClient {
  const parsedEndpoint = normalizeAzureEndpoint(env.AZURE_OPENAI_ENDPOINT);

  if (!parsedEndpoint) {
    throw new Error("AZURE_OPENAI_ENDPOINT is invalid.");
  }

  const pathname = parsedEndpoint.pathname.toLowerCase().replace(/\/$/, "");
  const isV1Endpoint = pathname.endsWith("/openai/v1");

  // Use standard OpenAI client for v1-style Azure AI Foundry endpoints
  if (isV1Endpoint) {
    const baseURL = parsedEndpoint.toString().replace(/\/$/, "");
    return {
      client: new OpenAI({
        apiKey: env.AZURE_OPENAI_API_KEY,
        baseURL,
      }),
      model: env.AZURE_OPENAI_MODEL,
    };
  }

  // Use AzureOpenAI client for traditional Azure OpenAI deployment endpoints
  parsedEndpoint.pathname = "";
  parsedEndpoint.search = "";
  parsedEndpoint.hash = "";
  const endpointRoot = parsedEndpoint.toString().replace(/\/$/, "");
  const deployment = env.AZURE_OPENAI_DEPLOYMENT ?? env.AZURE_OPENAI_MODEL;

  return {
    client: new AzureOpenAI({
      endpoint: endpointRoot,
      apiKey: env.AZURE_OPENAI_API_KEY,
      apiVersion: env.AZURE_OPENAI_API_VERSION,
      deployment,
    }),
    model: deployment,
  };
}
