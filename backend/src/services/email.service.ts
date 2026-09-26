import nodemailer, { Transporter } from "nodemailer";
import { env } from "../config/env";
import { logger } from "../utils/logger";

/** User-controlled values (names, task/job titles, reasons) are escaped before being placed in
 * email HTML, so they can't inject markup or links into messages sent from our domain. */
function esc(value: unknown): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

function formatInr(amount: number): string {
  return `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

let transporter: Transporter | null = null;

/** Created on first use so a process that never sends mail never opens an SMTP connection. */
function getTransporter(): Transporter {
  transporter ??= nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    // 465 is implicit TLS; other ports (587/25) upgrade via STARTTLS.
    secure: env.smtp.port === 465,
    auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.password } : undefined,
  });
  return transporter;
}

/**
 * Sends through SMTP (`SMTP_*` env vars). Without `SMTP_HOST` emails are only logged. Resolves
 * to whether the message was actually handed to the SMTP server — it never throws, because
 * every email is a side effect of a change that has already been committed, and a mail outage
 * must not turn that into an error response.
 */
async function send(payload: EmailPayload): Promise<boolean> {
  if (!env.smtp.host) {
    logger.info("Email (SMTP not configured, not sent)", { to: payload.to, subject: payload.subject });
    return false;
  }
  try {
    await getTransporter().sendMail({ from: env.emailFrom, ...payload });
    logger.info("Email sent", { to: payload.to, subject: payload.subject });
    return true;
  } catch (error) {
    logger.error(`Email to ${payload.to} failed ("${payload.subject}")`, error);
    return false;
  }
}

export interface PaymentApprovedEmail {
  name: string;
  courseName: string;
  batchName?: string;
  amount: number;
  paidAfterApproval: number;
  remainingAfterApproval: number;
  receiptNumber?: string;
  paymentDate: Date;
}

export interface PaymentRecordedEmail extends PaymentApprovedEmail {
  paymentMethod: string;
}

export const emailService = {
  sendOtpVerification: (to: string, otp: string) =>
    send({
      to,
      subject: "Verify your SSR Portal account",
      html: `<p>Your verification code is <strong>${otp}</strong>. It expires in ${env.otpExpiresMinutes} minutes.</p>`,
    }),

  sendAccountApproved: (to: string, name: string) =>
    send({
      to,
      subject: "Your SSR Portal account has been approved",
      html: `<p>Hi ${esc(name)}, your account has been approved. You can now log in to SSR Portal.</p>`,
    }),

  sendAccountRejected: (to: string, name: string, reason?: string) =>
    send({
      to,
      subject: "Your SSR Portal registration was not approved",
      html: `<p>Hi ${esc(name)}, unfortunately your registration was not approved.${
        reason ? ` Reason: ${esc(reason)}` : ""
      }</p>`,
    }),

  sendPasswordReset: (to: string, resetUrl: string) =>
    send({
      to,
      subject: "Reset your SSR Portal password",
      html: `<p>Click the link below to reset your password. This link expires in ${env.resetTokenExpiresMinutes} minutes.</p><p><a href="${esc(resetUrl)}">${esc(resetUrl)}</a></p>`,
    }),

  sendSubmissionEvaluated: (to: string, name: string, taskTitle: string, marks: number, maxMarks: number) =>
    send({
      to,
      subject: `Your submission for "${taskTitle}" has been evaluated`,
      html: `<p>Hi ${esc(name)}, your submission for <strong>${esc(taskTitle)}</strong> has been evaluated: ${marks}/${maxMarks}.</p>`,
    }),

  sendInterviewScheduled: (to: string, name: string, date: string, time: string) =>
    send({
      to,
      subject: "A mock interview has been scheduled for you",
      html: `<p>Hi ${esc(name)}, a mock interview has been scheduled on ${esc(date)} at ${esc(time)}.</p>`,
    }),

  sendCertificateIssued: (to: string, name: string, courseName: string, certificateNumber: string) =>
    send({
      to,
      subject: "Your certificate is ready",
      html: `<p>Hi ${esc(name)}, your certificate for <strong>${esc(courseName)}</strong> has been issued. Certificate number: ${esc(certificateNumber)}.</p>`,
    }),

  sendApplicationStatusChanged: (to: string, name: string, jobTitle: string, company: string, status: string) =>
    send({
      to,
      subject: `Update on your application to ${company}`,
      html: `<p>Hi ${esc(name)}, your application for <strong>${esc(jobTitle)}</strong> at ${esc(company)} is now <strong>${esc(status)}</strong>.</p>`,
    }),

  /** Sent automatically when an admin approves a payment screenshot. Figures come from the
   * committed approval, never from the client. */
  sendPaymentApproved: (to: string, p: PaymentApprovedEmail) =>
    send(buildPaymentEmail(to, p, {
      subject: `Payment approved — ${formatInr(p.amount)} for ${p.courseName}`,
      intro: "Your payment has been approved by SSR Institute Admin.",
      amountLabel: "Amount approved",
    })),

  /** Sent automatically when an admin records a cash (or other offline) payment. */
  sendPaymentRecorded: (to: string, p: PaymentRecordedEmail) => {
    const method = p.paymentMethod === "CASH" ? "cash payment" : `${p.paymentMethod.replace("_", " ").toLowerCase()} payment`;
    return send(buildPaymentEmail(to, p, {
      subject: `Payment received — ${formatInr(p.amount)} for ${p.courseName}`,
      intro: `Your ${method} has been received and recorded by SSR Institute.`,
      amountLabel: "Amount received",
      extraRows: [["Payment method", p.paymentMethod.replace("_", " ")]],
    }));
  },
};

/** Shared layout for payment confirmation emails. All values are escaped. */
function buildPaymentEmail(
  to: string,
  p: PaymentApprovedEmail,
  opts: { subject: string; intro: string; amountLabel: string; extraRows?: [string, string][] }
): EmailPayload {
  const fullyPaid = p.remainingAfterApproval <= 0;
  const feesUrl = `${env.clientUrl}/student/fees`;
  const rows: [string, string][] = [
    ["Course", p.courseName],
    ...(p.batchName ? ([["Batch", p.batchName]] as [string, string][]) : []),
    [opts.amountLabel, formatInr(p.amount)],
    ...(opts.extraRows ?? []),
    ["Total paid", formatInr(p.paidAfterApproval)],
    ["Remaining fee", formatInr(Math.max(0, p.remainingAfterApproval))],
    ["Payment date", p.paymentDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })],
    ...(p.receiptNumber ? ([["Receipt number", p.receiptNumber]] as [string, string][]) : []),
  ];
  return {
    to,
    subject: fullyPaid ? `Course fee fully paid — ${p.courseName}` : opts.subject,
    html: `<p>Hello ${esc(p.name)},</p>
<p>${esc(opts.intro)}${fullyPaid ? " Your course fee is now <strong>fully paid</strong>." : ""}</p>
<table cellpadding="6" style="border-collapse:collapse">${rows
      .map(([label, value]) => `<tr><td style="color:#64748b">${esc(label)}</td><td><strong>${esc(value)}</strong></td></tr>`)
      .join("")}</table>
<p>Please log in to the portal to view and download your payment receipt: <a href="${esc(feesUrl)}">${esc(feesUrl)}</a></p>
<p>Thank you,<br/>SSR Institute</p>`,
  };
}
