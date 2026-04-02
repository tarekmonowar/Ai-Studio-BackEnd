import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import type { AppEnv } from "../../config/env.js";
import { readJsonBody, sendJsonResponse } from "../../utils/http.js";
import { sendAgentEmail } from "./email.service.js";

const sendEmailBodySchema = z.object({
  recipient: z.string().email(),
  body: z.string().min(1),
});

function getPathname(req: IncomingMessage): string {
  return new URL(req.url ?? "/", "http://localhost").pathname;
}

export async function handleSendEmailToolRoute(
  req: IncomingMessage,
  res: ServerResponse,
  env: AppEnv,
): Promise<boolean> {
  if (req.method !== "POST") {
    return false;
  }

  if (getPathname(req) !== "/ai/tools/send-email") {
    return false;
  }

  try {
    const body = await readJsonBody(req);
    const parsedBody = sendEmailBodySchema.parse(body);
    await sendAgentEmail(parsedBody, env);

    sendJsonResponse(res, {
      req,
      statusCode: 200,
      payload: {
        ok: true,
        message: "Email sent successfully.",
      },
      env,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to send email.";

    sendJsonResponse(res, {
      req,
      statusCode: 400,
      payload: {
        ok: false,
        message,
      },
      env,
    });
  }

  return true;
}
