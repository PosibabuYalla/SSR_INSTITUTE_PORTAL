/**
 * The SMTP transport is mocked — these tests check what the email service hands to nodemailer,
 * never a real mail server. `env` is read at import time, so each case loads a fresh module
 * graph with the SMTP variables it needs.
 */
const sendMail = jest.fn();
const createTransport = jest.fn(() => ({ sendMail }));
jest.mock("nodemailer", () => ({ __esModule: true, default: { createTransport } }));
// config/env.ts calls dotenv.config(); without this a developer's real backend/.env would leak
// SMTP settings into these cases.
jest.mock("dotenv", () => ({ __esModule: true, default: { config: jest.fn() }, config: jest.fn() }));

type EmailModule = typeof import("../src/services/email.service");

function loadEmailService(smtp: Record<string, string | undefined>): EmailModule {
  const keys = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "EMAIL_FROM"];
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  for (const k of keys) delete process.env[k];
  Object.assign(process.env, smtp);
  try {
    let mod: EmailModule | undefined;
    jest.isolateModules(() => {
      mod = jest.requireActual("../src/services/email.service") as EmailModule;
    });
    return mod!;
  } finally {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

const approval = {
  name: "Asha <b>Student</b>",
  courseName: "MERN Full Stack",
  batchName: "MERN Batch 1",
  amount: 4000,
  paidAfterApproval: 4000,
  remainingAfterApproval: 6000,
  receiptNumber: "RCPT-TEST-0001",
  paymentDate: new Date("2026-09-20T10:00:00Z"),
};

describe("email service", () => {
  beforeEach(() => {
    sendMail.mockReset();
    createTransport.mockClear();
  });

  it("only logs (and reports not sent) when SMTP_HOST is not configured", async () => {
    const { emailService } = loadEmailService({});
    await expect(emailService.sendPaymentApproved("asha@test.local", approval)).resolves.toBe(false);
    expect(createTransport).not.toHaveBeenCalled();
  });

  it("sends the payment-approved email over SMTP with the approval details, escaping user input", async () => {
    sendMail.mockResolvedValue({ messageId: "1" });
    const { emailService } = loadEmailService({
      SMTP_HOST: "smtp.test.local",
      SMTP_PORT: "465",
      SMTP_USER: "mailer",
      SMTP_PASSWORD: "YOUR_SMTP_PASSWORD_HERE",
      EMAIL_FROM: "fees@test.local",
    });

    await expect(emailService.sendPaymentApproved("asha@test.local", approval)).resolves.toBe(true);

    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ host: "smtp.test.local", port: 465, secure: true, auth: { user: "mailer", pass: "YOUR_SMTP_PASSWORD_HERE" } })
    );
    const mail = sendMail.mock.calls[0][0];
    expect(mail).toMatchObject({ from: "fees@test.local", to: "asha@test.local" });
    expect(mail.subject).toBe("Payment approved — ₹4,000 for MERN Full Stack");
    expect(mail.html).toContain("RCPT-TEST-0001");
    expect(mail.html).toContain("₹6,000");
    expect(mail.html).toContain("http://localhost:3000/student/fees");
    expect(mail.html).toContain("Asha &lt;b&gt;Student&lt;/b&gt;");
    expect(mail.html).not.toContain("<b>Student</b>");
  });

  it("uses the fully-paid subject when nothing remains", async () => {
    sendMail.mockResolvedValue({ messageId: "2" });
    const { emailService } = loadEmailService({ SMTP_HOST: "smtp.test.local" });
    await emailService.sendPaymentApproved("asha@test.local", { ...approval, paidAfterApproval: 10000, remainingAfterApproval: 0 });
    expect(sendMail.mock.calls[0][0].subject).toBe("Course fee fully paid — MERN Full Stack");
    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({ port: 587, secure: false, auth: undefined }));
  });

  it("sends a payment-received email for cash payments recorded by an admin", async () => {
    sendMail.mockResolvedValue({ messageId: "3" });
    const { emailService } = loadEmailService({ SMTP_HOST: "smtp.test.local" });
    await expect(
      emailService.sendPaymentRecorded("asha@test.local", { ...approval, paymentMethod: "CASH" })
    ).resolves.toBe(true);
    const mail = sendMail.mock.calls[0][0];
    expect(mail.subject).toBe("Payment received — ₹4,000 for MERN Full Stack");
    expect(mail.html).toContain("Your cash payment has been received and recorded by SSR Institute.");
    expect(mail.html).toContain("Amount received");
    expect(mail.html).toContain("CASH");
    expect(mail.html).toContain("RCPT-TEST-0001");
  });

  it("never throws when the SMTP server fails — it reports not sent", async () => {
    sendMail.mockRejectedValue(new Error("connection refused"));
    const { emailService } = loadEmailService({ SMTP_HOST: "smtp.test.local" });
    await expect(emailService.sendPaymentApproved("asha@test.local", approval)).resolves.toBe(false);
  });
});
