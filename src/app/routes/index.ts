import type { AppEnv } from "../config/env.js";
import { handleAgentChatRoute } from "../modules/AiAgents/AiAgents.router.js";
import { handleHealthRoute } from "../modules/health/health.router.js";
import { handleGetLogsRoute } from "../modules/logs/logs.router.js";
import { handleSendEmailToolRoute } from "../modules/tools/tools.router.js";
import type {
  HttpRequest,
  HttpResponse,
  ModuleRouteDefinition,
} from "../types/route.types.js";

function getPathname(req: HttpRequest): string {
  return new URL(req.url ?? "/", "http://localhost").pathname;
}

// Module route definitions (Express-style registry for readability)
export const moduleRoutes: ModuleRouteDefinition[] = [
  { method: "GET", path: "/", route: handleHealthRoute },
  { method: "GET", path: "/health", route: handleHealthRoute },
  { method: "GET", path: "/getLogs", route: handleGetLogsRoute },
  { method: "POST", path: "/ai/agent-chat", route: handleAgentChatRoute },
  {
    method: "POST",
    path: "/ai/tools/send-email",
    route: handleSendEmailToolRoute,
  },
];

export async function handleHttpRoutes(
  req: HttpRequest,
  res: HttpResponse,
  env: AppEnv,
): Promise<boolean> {
  const pathname = getPathname(req);
  const method = (req.method ?? "").toUpperCase();

  for (const moduleRoute of moduleRoutes) {
    if (moduleRoute.method !== method || moduleRoute.path !== pathname) {
      continue;
    }

    if (await moduleRoute.route(req, res, env)) {
      return true;
    }
  }

  return false;
}
