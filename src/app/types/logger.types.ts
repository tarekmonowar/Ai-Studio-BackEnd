export type LogLevel = "info" | "warn" | "error";

export interface StoredLogFile {
  fileName: string;
  content: string;
  lineCount: number;
}
