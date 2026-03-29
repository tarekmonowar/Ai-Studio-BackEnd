import { WebSocketServer } from "ws";
import { createHttpServer } from "./app/utils/httpServer.js";
import { env } from "./app/config/env.js";
import { registerVoiceSocketRoute } from "./app/modules/voice/voice.router.js";

const server = createHttpServer(env);

const MAX_PORT_RETRIES = 6;

function startServer(port: number, retriesLeft: number): void {
  const onError = (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE" && retriesLeft > 0) {
      const nextPort = port + 1;
      console.warn(
        `Port ${port} is already in use. Retrying on port ${nextPort}...`,
      );
      startServer(nextPort, retriesLeft - 1);
      return;
    }

    console.error("Failed to start voice gateway:", error);
    process.exit(1);
  };

  server.once("error", onError);

  server.listen(port, () => {
    server.off("error", onError);

    const wss = new WebSocketServer({ server, path: "/ws" });
    registerVoiceSocketRoute(wss, env);

    console.log(`Voice gateway is running on http://localhost:${port}`);
    console.log(`WebSocket endpoint: ws://localhost:${port}/ws`);

    if (port !== env.PORT) {
      console.warn(
        `Update frontend backend URL to use port ${port} if needed.`,
      );
    }
  });
}

startServer(env.PORT, MAX_PORT_RETRIES);
