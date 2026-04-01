import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
} from "node:fs";
import path from "node:path";
import type { LogLevel, StoredLogFile } from "../types/logger.types.js";

export type { LogLevel, StoredLogFile } from "../types/logger.types.js";

function resolveLogsDir(): string {
  return path.resolve(process.cwd(), "logs");
}

function ensureLogsDir(): string {
  const logsDir = resolveLogsDir();
  if (!existsSync(logsDir)) {
    mkdirSync(logsDir, { recursive: true });
  }
  return logsDir;
}

function getLogFilePath(date: Date): string {
  const dayStamp = date.toISOString().slice(0, 10);
  return path.join(ensureLogsDir(), `${dayStamp}.log`);
}

function formatMeta(meta: unknown): string {
  if (meta === undefined) {
    return "";
  }

  if (meta instanceof Error) {
    return ` ${meta.stack ?? meta.message}`;
  }

  if (typeof meta === "string") {
    return ` ${meta}`;
  }

  try {
    return ` ${JSON.stringify(meta)}`;
  } catch {
    return " [unserializable-meta]";
  }
}

function writeEntry(level: LogLevel, message: string, meta?: unknown): void {
  const now = new Date();
  const line = `[${now.toISOString()}] ${level.toUpperCase()} ${message}${formatMeta(meta)}`;

  try {
    appendFileSync(getLogFilePath(now), `${line}\n`, "utf8");
  } catch (error) {
    process.stderr.write(`Logger file write failed: ${String(error)}\n`);
  }

  if (level === "error") {
    process.stderr.write(`${line}\n`);
    return;
  }

  process.stdout.write(`${line}\n`);
}

export const logger = {
  info(message: string, meta?: unknown): void {
    writeEntry("info", message, meta);
  },
  warn(message: string, meta?: unknown): void {
    writeEntry("warn", message, meta);
  },
  error(message: string, meta?: unknown): void {
    writeEntry("error", message, meta);
  },
};

export function getStoredLogs(): StoredLogFile[] {
  const logsDir = resolveLogsDir();
  if (!existsSync(logsDir)) {
    return [];
  }

  const files = readdirSync(logsDir)
    .filter((fileName) => fileName.endsWith(".log"))
    .sort((a, b) => b.localeCompare(a));

  return files.map((fileName) => {
    const content = readFileSync(path.join(logsDir, fileName), "utf8");
    const lineCount = content.trim() ? content.trim().split(/\r?\n/).length : 0;

    return {
      fileName,
      content,
      lineCount,
    };
  });
}
