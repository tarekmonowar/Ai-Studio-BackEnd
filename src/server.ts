import http from "node:http";
import { WebSocketServer } from "ws";
import { createApp } from "./app.js";
import { env } from "./app/config/env.js";
import { registerVoiceSocketRoute } from "./app/modules/voice/voice.router.js";
import { logger } from "./app/utils/logger.js";

const app = createApp(env);
const server = http.createServer(app);

const MAX_PORT_RETRIES = 6;

function startServer(port: number, retriesLeft: number): void {
  const onError = (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE" && retriesLeft > 0) {
      const nextPort = port + 1;
      logger.warn(
        `Port ${port} is already in use. Retrying on port ${nextPort}...`,
      );
      startServer(nextPort, retriesLeft - 1);
      return;
    }

    logger.error("Failed to start voice gateway", error);
    process.exit(1);
  };

  server.once("error", onError);

  server.listen(port, () => {
    server.off("error", onError);

    const wss = new WebSocketServer({ server, path: "/ws" });
    registerVoiceSocketRoute(wss, env);

    logger.info(`Voice gateway is running on http://localhost:${port}`);
    logger.info(`WebSocket endpoint: ws://localhost:${port}/ws`);

    if (port !== env.PORT) {
      logger.warn(`Update frontend backend URL to use port ${port} if needed.`);
    }
  });
}

startServer(env.PORT, MAX_PORT_RETRIES);
