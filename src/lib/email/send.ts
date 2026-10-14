import nodemailer from "nodemailer";

/**
 * Sends email through Resend (https://resend.com/docs/api-reference/emails/send-email)
 * when RESEND_API_KEY is set, otherwise through a Gmail account with an app password.
 * Returns false instead of throwing when neither is configured, so checkout keeps
 * working in development and before a mailer is set up.
 */
type Mailer = "resend" | "gmail";

const env = (name: string) => process.env[name]?.trim() || undefined;

export function mailer(): Mailer | null {
  if (env("RESEND_API_KEY") && env("EMAIL_FROM")) return "resend";
  if (env("GMAIL_USER") && env("GMAIL_APP_PASSWORD")) return "gmail";
  return null;
}

export const emailEnabled = () => mailer() !== null;

type Message = { to: string; subject: string; html: string; text: string };

export async function sendEmail(msg: Message) {
  const via = mailer();
  if (!via) {
    console.info(`[email] not configured; skipped "${msg.subject}" to ${msg.to}`);
    return false;
  }
  if (via === "resend") await sendWithResend(msg);
  else await sendWithGmail(msg);
  return true;
}

async function sendWithResend(msg: Message) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env("RESEND_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env("EMAIL_FROM"),
      to: [msg.to],
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      ...(env("EMAIL_REPLY_TO") ? { reply_to: env("EMAIL_REPLY_TO") } : {}),
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Resend ${res.status}: ${await res.text().catch(() => "")}`);
  }
}

/** Display name shown as the sender in Gmail mode, e.g. "RESIST". */
export const GMAIL_SENDER_NAME = "RESIST";

async function sendWithGmail(msg: Message) {
  const user = env("GMAIL_USER")!;
  // Google shows app passwords in groups of four ("abcd efgh ijkl mnop"); spaces aren't part of it.
  const pass = env("GMAIL_APP_PASSWORD")!.replace(/\s+/g, "");
  const transport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  });
  // Gmail only sends as the signed-in account, so the address is always GMAIL_USER.
  await transport.sendMail({
    from: { name: GMAIL_SENDER_NAME, address: user },
    to: msg.to,
    subject: msg.subject,
    html: msg.html,
    text: msg.text,
    ...(env("EMAIL_REPLY_TO") ? { replyTo: env("EMAIL_REPLY_TO") } : {}),
  });
}
