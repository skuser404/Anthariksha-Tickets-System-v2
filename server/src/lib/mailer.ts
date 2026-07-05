import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

/**
 * In dev (no SMTP_HOST configured) we use a JSON transport that prints the
 * message to the console instead of sending it — so OTP flows are testable
 * without a real mail server.
 */
const transport = env.mail.host
  ? nodemailer.createTransport({
      host: env.mail.host,
      port: env.mail.port,
      secure: env.mail.port === 465,
      auth: env.mail.user ? { user: env.mail.user, pass: env.mail.pass } : undefined,
    })
  : nodemailer.createTransport({ jsonTransport: true });

export async function sendMail(to: string, subject: string, html: string): Promise<void> {
  const info = await transport.sendMail({ from: env.mail.from, to, subject, html });
  if (!env.mail.host) {
    // Dev: surface the email (and any OTP within) in the server log.
    // eslint-disable-next-line no-console
    console.log(`\n📧 [DEV EMAIL] to=${to} subject="${subject}"\n${stripHtml(html)}\n`);
  }
  return void info;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/\s+\n/g, '\n').trim();
}
