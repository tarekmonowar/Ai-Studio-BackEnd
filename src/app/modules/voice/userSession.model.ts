import mongoose, { Schema, model } from "mongoose";

const userSessionSchema = new Schema(
  {
    userIp: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },
    firstSeen: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    versionKey: false,
    collection: "user_sessions",
  },
);

export const UserSessionModel =
  mongoose.models.UserSession ?? model("UserSession", userSessionSchema);
