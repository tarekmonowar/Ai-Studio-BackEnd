import mongoose, { Schema, model } from "mongoose";

const messageSchema = new Schema(
  {
    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
    },
    content: { type: String, required: true, trim: true },
    timestamp: { type: Date, default: Date.now },
  },
  {
    _id: false,
  },
);

const conversationLogSchema = new Schema(
  {
    sessionId: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },
    userIp: { type: String, required: true, trim: true },
    topic: { type: String, required: true, trim: true },
    messages: { type: [messageSchema], default: [] },
  },
  {
    versionKey: false,
    collection: "conversation_logs",
  },
);

export const ConversationLogModel =
  mongoose.models.ConversationLog ??
  model("ConversationLog", conversationLogSchema);
