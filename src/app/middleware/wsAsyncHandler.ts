import type { WebSocket } from "ws";

export function withWsAsyncHandler<T extends unknown[]>(
  socket: WebSocket,
  handler: (...args: T) => Promise<void>,
) {
  return (...args: T) => {
    void handler(...args).catch((error) => {
      const message =
        error instanceof Error
          ? error.message
          : "Unexpected websocket handler error";
      if (socket.readyState === socket.OPEN) {
        socket.send(
          JSON.stringify({
            type: "error",
            message,
            code: "WS_HANDLER_ERROR",
            hint: "Please retry. If this keeps happening, restart backend.",
          }),
        );
      }
    });
  };
}
