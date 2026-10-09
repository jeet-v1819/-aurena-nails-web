/**
 * Transactional email.
 *
 * Configure any SMTP provider through EMAIL_SERVER / EMAIL_USERNAME /
 * EMAIL_PASSWORD. When no SMTP server is configured (development, preview
 * environments, CI) messages are **not** silently dropped: they are logged to
 * the server console so password-reset links remain usable, and the caller
 * learns about it through the `delivered` flag.
 */
import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { escapeHtml } from "@/lib/html";

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type SendEmailResult = {
  delivered: boolean;
  skippedReason?: string;
};

let transporter: Transporter | null = null;

function emailConfigured() {
  return Boolean(process.env.EMAIL_SERVER && process.env.EMAIL_USERNAME && process.env.EMAIL_PASSWORD);
}

function getTransporter(): Transporter | null {
  if (!emailConfigured()) return null;
  if (transporter) return transporter;

  const port = Number(process.env.EMAIL_PORT ?? 587);
  const secure = process.env.EMAIL_SECURE === "true" || port === 465;

  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_SERVER,
    port,
    secure,
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  return transporter;
}

export async function sendEmail({ to, subject, html, text }: SendEmailInput): Promise<SendEmailResult> {
  const mailer = getTransporter();

  if (!mailer) {
    console.info(
      `[email] SMTP is not configured — printing instead.\n  To: ${to}\n  Subject: ${subject}\n  ${text.replace(/\n/g, "\n  ")}`
    );
    return { delivered: false, skippedReason: "SMTP_NOT_CONFIGURED" };
  }

  try {
    await mailer.sendMail({
      from: process.env.EMAIL_FROM ?? "Aurena Nails <hello@aurenanails.com>",
      to,
      subject: subject.replace(/[\r\n]+/g, " ").slice(0, 200),
      text,
      html,
    });
    return { delivered: true };
  } catch (error) {
    console.error("[email] delivery failed:", error);
    return { delivered: false, skippedReason: "SEND_FAILED" };
  }
}

/** Shared, on-brand layout for every transactional email. */
export function emailLayout(title: string, body: string, footerNote?: string) {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#fbf7f4;font-family:'Poppins',Helvetica,Arial,sans-serif;color:#2b2427;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e9ded7;border-radius:20px;overflow:hidden;">
      <tr>
        <td style="padding:28px 32px;background:linear-gradient(135deg,#b76e79,#96545f);color:#fff;">
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;letter-spacing:0.08em;">AURENA NAILS</div>
          <div style="font-size:12px;letter-spacing:0.22em;text-transform:uppercase;opacity:0.85;margin-top:4px;">Luxury Nail Art</div>
        </td>
      </tr>
      <tr>
        <td style="padding:32px;">
          <h1 style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:500;margin:0 0 16px;">${escapeHtml(title)}</h1>
          <div style="font-size:15px;line-height:1.7;color:#4a4045;">${body}</div>
        </td>
      </tr>
      <tr>
        <td style="padding:20px 32px 28px;border-top:1px solid #e9ded7;font-size:12px;color:#7c6f73;">
          ${escapeHtml(footerNote ?? "Aurena Nails · Bandra West, Mumbai · hello@aurenanails.com")}
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function emailButton(url: string, label: string) {
  return `<p style="margin:24px 0;">
    <a href="${escapeHtml(url)}" style="display:inline-block;background:#b76e79;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:999px;font-size:14px;">${escapeHtml(label)}</a>
  </p>
  <p style="font-size:12px;color:#7c6f73;word-break:break-all;">${escapeHtml(url)}</p>`;
}
