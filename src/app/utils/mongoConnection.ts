import mongoose from "mongoose";

let connectPromise: Promise<typeof mongoose> | null = null;
let missingUriNotified = false;

export async function ensureMongoConnectionReady(): Promise<void> {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is not configured");
  }

  const readyState = mongoose.connection.readyState;
  if (readyState === 1 || readyState === 2) {
    return;
  }

  if (!connectPromise) {
    connectPromise = mongoose.connect(uri).catch((error) => {
      connectPromise = null;
      throw error;
    });
  }

  await connectPromise;
}

export function ensureMongoConnection(): void {
  if (!process.env.MONGODB_URI) {
    if (!missingUriNotified) {
      missingUriNotified = true;
      console.error(
        "MONGODB_URI is not configured. Conversation logging is disabled.",
      );
    }
    return;
  }

  void ensureMongoConnectionReady().catch((error) => {
    console.error("MongoDB connection failed:", error);
  });
}
