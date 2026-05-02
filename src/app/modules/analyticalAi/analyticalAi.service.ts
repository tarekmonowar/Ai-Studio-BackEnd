import type { AppEnv } from "../../config/env.js";
import { getAnalyticalAiClients } from "./analyticalAi.client.js";

const EMBEDDING_DIMENSIONS = 1536;
const SUPABASE_TABLE = "vecto_embedding";

/**
 * Creates an embedding for the given text and stores it in Supabase vector DB.
 */
export async function storeEmbedding(
  text: string,
  env: AppEnv,
): Promise<{ success: boolean; message: string }> {
  const { openai, supabase, embeddingModel } = getAnalyticalAiClients(env);

  // Generate embedding vector from the input text
  const embeddingResponse = await openai.embeddings.create({
    model: embeddingModel,
    input: text,
    dimensions: EMBEDDING_DIMENSIONS,
  });

  const embedding = embeddingResponse.data[0].embedding;

  // Store the text and its embedding vector in Supabase
  const { error } = await supabase.from(SUPABASE_TABLE).insert({
    content: text,
    embedding,
  });

  if (error) {
    throw new Error(`Supabase insert failed: ${error.message}`);
  }

  return {
    success: true,
    message: "Text has been embedded and stored in the vector database.",
  };
}

/**
 * Creates an embedding for the query and searches Supabase for
 * semantically similar documents using the match_documents RPC function.
 */
export async function queryEmbedding(
  query: string,
  env: AppEnv,
): Promise<{
  results: Array<{ content: string; similarity: number }>;
}> {
  const { openai, supabase, embeddingModel } = getAnalyticalAiClients(env);

  // Generate embedding vector from the query
  const embeddingResponse = await openai.embeddings.create({
    model: embeddingModel,
    input: query,
    dimensions: EMBEDDING_DIMENSIONS,
  });

  const embedding = embeddingResponse.data[0].embedding;

  // Search Supabase for nearest vector matches
  const { data, error } = await supabase.rpc("match_documents", {
    query_embedding: embedding,
    match_threshold: 0.1,
    match_count: 3,
  });

  if (error) {
    throw new Error(`Supabase query failed: ${error.message}`);
  }

  const results = (data ?? []).map(
    (row: { content: string; similarity: number }) => ({
      content: row.content,
      similarity: row.similarity,
    }),
  );

  return { results };
}
