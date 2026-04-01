import type { IncomingMessage, ServerResponse } from "node:http";
import type { AppEnv } from "./env.types.js";

export type HttpRequest = IncomingMessage;
export type HttpResponse = ServerResponse;

export type HttpMethod = "GET";

export type HttpRouteHandler = (
  req: HttpRequest,
  res: HttpResponse,
  env: AppEnv,
) => boolean;

export interface ModuleRouteDefinition {
  method: HttpMethod;
  path: string;
  route: HttpRouteHandler;
}
