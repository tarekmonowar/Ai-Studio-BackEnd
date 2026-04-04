import nodemailer from "nodemailer";
import type { AppEnv } from "../../config/env.js";

interface SendEmailInput {
  recipient: string;
  body: string;
}

const SUBJECT = "Message from Ai-Studio";
const PHYSICAL_ADDRESS = "Sylhet, Bangladesh";
const UNSUBSCRIBE_BASE_URL = "https://tarekmonowar.dev/unsubscribe";

function assertEmailConfig(env: AppEnv): void {
  if (!env.EMAIL_USER || !env.EMAIL_PASS || !env.EMAIL_FROM) {
    throw new Error(
      "Email tool is not configured. Set EMAIL_USER, EMAIL_PASS, and EMAIL_FROM.",
    );
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeBody(body: string): string {
  return body.replace(/\r\n/g, "\n").trim();
}

function countSentences(text: string): number {
  return text
    .split(/[.!?]+/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0).length;
}

function ensureProfessionalBody(body: string): string {
  let normalized = normalizeBody(body).replace(/\s+/g, " ").trim();

  if (!normalized) {
    normalized =
      "Hello, thank you for your time today. I wanted to share this message with you. Please let me know if you have any questions.";
  }

  if (!/[.!?]$/.test(normalized)) {
    normalized += ".";
  }

  return normalized;
}

function getEmailAddress(fromValue: string): string {
  const match = fromValue.match(/<([^>]+)>/);
  if (match?.[1]) {
    return match[1].trim();
  }

  return fromValue.trim();
}

function improveSenderLocalPart(address: string): string {
  const [localPart, domain] = address.split("@");
  if (!localPart || !domain) {
    return address;
  }

  const normalizedLocal = localPart.trim().toLowerCase();
  if (normalizedLocal === "no-reply" || normalizedLocal === "noreply") {
    return `hello@${domain.trim().toLowerCase()}`;
  }

  return `${localPart.trim()}@${domain.trim().toLowerCase()}`;
}

function formatFromAddress(rawFrom: string): string {
  const address = improveSenderLocalPart(getEmailAddress(rawFrom));
  return `"Tarek Monowar" <${address}>`;
}

function buildUnsubscribeUrl(recipient: string): string {
  return `${UNSUBSCRIBE_BASE_URL}?email=${encodeURIComponent(recipient)}`;
}

function buildPlainText(body: string, recipient: string): string {
  const unsubscribeUrl = buildUnsubscribeUrl(recipient);

  return `${body}\n\n---\nBest regards,\nTarek Monowar\n${PHYSICAL_ADDRESS}\nUnsubscribe: ${unsubscribeUrl}`;
}

function buildHtml(body: string, recipient: string): string {
  const unsubscribeUrl = buildUnsubscribeUrl(recipient);

  const bodyHtml = body
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0)
    .map(
      (sentence) => `<p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #333333;">${escapeHtml(sentence)}</p>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Message</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f7f9fc; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f7f9fc; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); overflow: hidden;">
                    <tr>
                        <td style="padding: 40px;">
                            ${bodyHtml}
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: #f8fafc; padding: 30px 40px; border-top: 1px solid #e2e8f0;">
                            <p style="margin: 0; font-size: 14px; color: #64748b;">Best regards,</p>
                            <p style="margin: 4px 0 0; font-size: 16px; font-weight: bold; color: #0f172a;">Tarek Monowar</p>
                            <p style="margin: 4px 0 0; font-size: 13px; color: #64748b;">${escapeHtml(PHYSICAL_ADDRESS)}</p>
                            
                            <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #e2e8f0;">
                                <p style="margin: 0; font-size: 12px; color: #94a3b8; text-align: center;">
                                    If you no longer wish to receive these emails, you can <a href="${unsubscribeUrl}" style="color: #3b82f6; text-decoration: none;">unsubscribe here</a>.
                                </p>
                            </div>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
}

export async function sendAgentEmail(
  input: SendEmailInput,
  env: AppEnv,
): Promise<void> {
  assertEmailConfig(env);

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: env.EMAIL_USER,
      pass: env.EMAIL_PASS,
    },
  });

  const from = formatFromAddress(env.EMAIL_FROM);
  const normalizedBody = ensureProfessionalBody(input.body);
  const unsubscribeUrl = buildUnsubscribeUrl(input.recipient);

  try {
    await transporter.sendMail({
      from,
      to: input.recipient,
      replyTo: getEmailAddress(from),
      subject: SUBJECT,
      text: buildPlainText(normalizedBody, input.recipient),
      html: buildHtml(normalizedBody, input.recipient),
      headers: {
        "List-Unsubscribe": `<${unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });
  } catch (error: any) {
    throw new Error(`Email sending error: ${error.message}`);
  }
}
