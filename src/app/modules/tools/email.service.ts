import { Resend } from "resend";
import type { AppEnv } from "../../config/env.js";

interface SendEmailInput {
  recipient: string;
  body: string;
}

const SUBJECT = "Message from Tarek Monowar";
const PHYSICAL_ADDRESS = "123 Park Avenue, New York, NY 10017, USA";
const UNSUBSCRIBE_BASE_URL = "https://tarekmonowar.dev/unsubscribe";

function assertEmailConfig(env: AppEnv): void {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    throw new Error(
      "Email tool is not configured. Set RESEND_API_KEY and EMAIL_FROM.",
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

  const extraSentences = [
    "Thank you for your time and attention.",
    "Please feel free to reply if you need any clarification.",
  ];

  let index = 0;
  while (countSentences(normalized) < 3 && index < extraSentences.length) {
    normalized += ` ${extraSentences[index]}`;
    index += 1;
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
  return `Tarek Monowar <${address}>`;
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
      (sentence) => `<p style="margin:0 0 12px;">${escapeHtml(sentence)}</p>`,
    )
    .join("");

  return `
<div style="font-family:Arial,sans-serif; font-size:15px; line-height:1.6; color:#111827;">
  ${bodyHtml}
  <div style="margin-top:16px; border-top:1px solid #e5e7eb; padding-top:12px; font-size:13px; color:#374151;">
    <p style="margin:0;">Best regards,</p>
    <p style="margin:4px 0 0; font-weight:600;">Tarek Monowar</p>
    <p style="margin:6px 0 0;">${escapeHtml(PHYSICAL_ADDRESS)}</p>
    <p style="margin:8px 0 0;">
      <a href="${unsubscribeUrl}" style="color:#0f766e; text-decoration:underline;">Unsubscribe</a>
    </p>
  </div>
</div>`;
}

export async function sendAgentEmail(
  input: SendEmailInput,
  env: AppEnv,
): Promise<void> {
  assertEmailConfig(env);

  const resend = new Resend(env.RESEND_API_KEY);
  const from = formatFromAddress(env.EMAIL_FROM);
  const normalizedBody = ensureProfessionalBody(input.body);
  const unsubscribeUrl = buildUnsubscribeUrl(input.recipient);

  const { error } = await resend.emails.send({
    from,
    to: [input.recipient],
    replyTo: getEmailAddress(from),
    subject: SUBJECT,
    text: buildPlainText(normalizedBody, input.recipient),
    html: buildHtml(normalizedBody, input.recipient),
    headers: {
      "List-Unsubscribe": `<${unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}
