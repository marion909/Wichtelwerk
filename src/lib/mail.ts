import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter | null = null;

export function appUrl(path = ""): string {
  const base = (process.env.APP_URL ?? process.env.AUTH_URL ?? "http://localhost:4000").replace(/\/$/, "");
  return `${base}${path}`;
}

function getTransporter() {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  });
  return transporter;
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export interface MailInput {
  to: string;
  subject: string;
  text: string;
  /** Beschriftung und Ziel des Buttons. */
  action?: { label: string; url: string };
}

function renderHtml({ subject, text, action }: MailInput): string {
  const paragraphs = text
    .split("\n\n")
    .map((p) => `<p style="margin:0 0 14px;line-height:1.55">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const button = action
    ? `<p style="margin:22px 0"><a href="${escapeHtml(action.url)}" style="background:#173F35;color:#FBF7EE;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:700;display:inline-block">${escapeHtml(action.label)}</a></p>
       <p style="margin:0;font-size:12px;color:#5d6e68">${escapeHtml(action.url)}</p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#FBF7EE;font-family:Nunito,Arial,sans-serif;color:#1b2a26">
  <div style="max-width:520px;margin:0 auto;padding:28px 20px">
    <img src="${appUrl("/brand/wichtelwerk-logo.png")}" alt="Wichtelwerk" height="40" style="height:40px;margin-bottom:18px">
    <div style="background:#fff;border:1px solid #e6dfcf;border-radius:16px;padding:24px">
      <h1 style="font-size:20px;margin:0 0 16px;color:#173F35">${escapeHtml(subject)}</h1>
      ${paragraphs}${button}
    </div>
    <p style="font-size:12px;color:#5d6e68;margin-top:16px">Wichtelwerk · ${escapeHtml(appUrl())}</p>
  </div></body></html>`;
}

/** Versendet eine Mail. Ohne SMTP-Konfiguration wird sie in der Konsole ausgegeben (Entwicklung). */
export async function sendMail(input: MailInput): Promise<void> {
  const t = getTransporter();
  const from = process.env.MAIL_FROM ?? "Wichtelwerk <noreply@wichtelwerk.neuhauser.cloud>";
  const text = input.action ? `${input.text}\n\n${input.action.label}: ${input.action.url}` : input.text;
  if (!t) {
    console.log(`\n[mail:dev] An: ${input.to}\nBetreff: ${input.subject}\n${text}\n`);
    return;
  }
  await t.sendMail({ from, to: input.to, subject: input.subject, text, html: renderHtml(input) });
}
