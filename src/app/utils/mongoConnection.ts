import mongoose from "mongoose";

let connectPromise: Promise<typeof mongoose> | null = null;
let missingUriNotified = false;

export function ensureMongoConnection(): void {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    if (!missingUriNotified) {
      missingUriNotified = true;
      console.error(
        "MONGODB_URI is not configured. Conversation logging is disabled.",
      );
    }
    return;
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

  void connectPromise.catch((error) => {
    console.error("MongoDB connection failed:", error);
  });
}
