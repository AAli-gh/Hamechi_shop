import nodemailer, { type Transporter } from "nodemailer";
import { logger } from "./logger";

/*
 * Email is optional: set SMTP_URL (e.g. smtps://user:pass@mail.example.com:465)
 * and MAIL_FROM to turn it on. MAIL_TRANSPORT=log writes messages to the log
 * instead of sending, for local development.
 *
 * When nothing is configured, sendMail() reports failure instead of pretending,
 * so callers leave their notifications pending rather than marking them sent.
 */
const FROM = process.env.MAIL_FROM ?? "بازارچه <no-reply@localhost>";
export const SITE_URL = (process.env.PUBLIC_SITE_URL ?? "").replace(/\/$/, "");

let transporter: Transporter | null | undefined;

function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter;
  if (process.env.MAIL_TRANSPORT === "log") {
    transporter = nodemailer.createTransport({ jsonTransport: true });
  } else if (process.env.SMTP_URL) {
    transporter = nodemailer.createTransport(process.env.SMTP_URL);
  } else {
    transporter = null;
  }
  return transporter;
}

export function isMailerConfigured(): boolean {
  return getTransporter() !== null;
}

export async function sendMail(message: { to: string; subject: string; html: string; text: string }): Promise<boolean> {
  const mailer = getTransporter();
  if (!mailer) {
    logger.warn({ to: message.to, subject: message.subject }, "email not sent: SMTP_URL is not configured");
    return false;
  }
  try {
    const info = await mailer.sendMail({ from: FROM, ...message });
    if (process.env.MAIL_TRANSPORT === "log") logger.info({ mail: info.message }, "email (log transport)");
    return true;
  } catch (err) {
    logger.error({ err, to: message.to, subject: message.subject }, "email failed");
    return false;
  }
}

/** Minimal RTL email shell so messages read correctly in Persian. */
export function emailLayout(title: string, bodyHtml: string): string {
  return `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:24px;background:#fffbf7;font-family:Tahoma,Arial,sans-serif;color:#33291f">
  <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #efe0d2;border-radius:16px;padding:24px">
    <h1 style="margin:0 0 16px;font-size:18px;color:#e25b12">بازارچه</h1>
    ${bodyHtml}
    <p style="margin-top:24px;font-size:12px;color:#7a6a5c">این پیام از طرف فروشگاه بازارچه ارسال شده است.</p>
  </div>
</body></html>`;
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
