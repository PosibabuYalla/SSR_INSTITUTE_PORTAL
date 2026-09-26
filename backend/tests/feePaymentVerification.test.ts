import request from "supertest";
import { createApp } from "../src/app";
import { Course } from "../src/models/Course";
import { Batch } from "../src/models/Batch";
import { Enrollment } from "../src/models/Enrollment";
import { Payment } from "../src/models/Payment";
import { PaymentRequest } from "../src/models/PaymentRequest";
import { Notification } from "../src/models/Notification";
import { emailService } from "../src/services/email.service";
import { createUser, authHeader } from "./helpers";

// Private storage is swapped for an in-memory map so tests don't touch disk/Cloudinary; the
// rest of upload.service stays real.
const store = new Map<string, Buffer>();
jest.mock("../src/services/upload.service", () => {
  const actual = jest.requireActual("../src/services/upload.service");
  let n = 0;
  return {
    ...actual,
    uploadPrivateImage: jest.fn(async (buffer: Buffer, mimeType: string, folder: string) => {
      n += 1;
      const key = `${folder}/test-${n}`;
      store.set(key, buffer);
      return { provider: "local", key, mimeType, bytes: buffer.length };
    }),
    readPrivateFile: jest.fn(async (ref: { key: string }) => store.get(ref.key) ?? Buffer.alloc(0)),
    deletePrivateFile: jest.fn(async (ref: { key: string }) => {
      store.delete(ref.key);
    }),
  };
});

const app = createApp();

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64, 1),
]);

async function setup(fee = 10000) {
  await Promise.all([PaymentRequest.init(), Payment.init()]);
  const course = await Course.create({
    name: "MERN Full Stack",
    shortDescription: "...",
    duration: "6 months",
    fee,
    status: "PUBLISHED",
  });
  const { user: trainer } = await createUser({ role: "TRAINER" });
  const batch = await Batch.create({
    name: "MERN Batch 1",
    course: course._id,
    trainer: trainer._id,
    startDate: new Date(),
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    classDays: ["MON"],
    startTime: "10:00",
    endTime: "12:00",
    mode: "ONLINE",
    capacity: 30,
  });
  const student = await createUser({ role: "STUDENT", name: "Asha Student" });
  const other = await createUser({ role: "STUDENT", name: "Other Student" });
  const admin = await createUser({ role: "ADMIN", name: "Admin One" });
  const admin2 = await createUser({ role: "ADMIN", name: "Admin Two" });
  const enrollment = await Enrollment.create({ student: student.user._id, batch: batch._id, course: course._id });
  const otherEnrollment = await Enrollment.create({ student: other.user._id, batch: batch._id, course: course._id });
  return { course, batch, student, other, admin, admin2, enrollment, otherEnrollment };
}

function submit(token: string, fields: Record<string, string | number>, file: { buf: Buffer; name: string; type: string } | null = { buf: PNG, name: "proof.png", type: "image/png" }) {
  let req = request(app).post("/api/v1/fees/payment-requests").set(authHeader(token));
  for (const [k, v] of Object.entries(fields)) req = req.field(k, String(v));
  if (file) req = req.attach("screenshot", file.buf, { filename: file.name, contentType: file.type });
  return req;
}

async function myStatus(token: string) {
  const res = await request(app).get("/api/v1/fees/my-status").set(authHeader(token));
  expect(res.status).toBe(200);
  return res.body.data[0];
}

describe("Fee payment verification workflow", () => {
  it("unpaid course → submit → under review → admin notified; screenshot key never exposed", async () => {
    const { student, admin, enrollment } = await setup();

    const before = await myStatus(student.token);
    expect(before).toMatchObject({ paymentStatus: "PENDING", canPay: true, amountPaid: 0, amountDue: 10000 });

    const res = await submit(student.token, { enrollmentId: enrollment._id.toString(), amount: 4000 });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      status: "PENDING",
      amount: 4000,
      totalFee: 10000,
      previousPaidAmount: 0,
      amountDueAtSubmission: 10000,
      hasScreenshot: true,
    });
    expect(res.body.data.screenshot).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain("payment-screenshots/");

    const after = await myStatus(student.token);
    expect(after).toMatchObject({ paymentStatus: "PAYMENT_UNDER_REVIEW", canPay: false });
    expect(after.pendingRequest.amount).toBe(4000);

    const adminNotes = await Notification.find({ user: admin.user._id, type: "PAYMENT_SUBMITTED" });
    expect(adminNotes).toHaveLength(1);
    expect(adminNotes[0].title).toBe("New Payment Verification Required");
    expect(adminNotes[0].message).toContain("Asha Student");
    expect(adminNotes[0].message).toContain("MERN Full Stack");
    expect(adminNotes[0].link).toBe("/admin/fees?tab=verification");
  });

  it("blocks a duplicate pending request, including concurrent submissions", async () => {
    const { student, enrollment } = await setup();
    const fields = { enrollmentId: enrollment._id.toString(), amount: 1000 };

    const results = await Promise.all([submit(student.token, fields), submit(student.token, fields)]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);

    const again = await submit(student.token, fields);
    expect(again.status).toBe(409);
    expect(await PaymentRequest.countDocuments({ enrollment: enrollment._id })).toBe(1);
  });

  it("rejects tampered payloads: extra status/amount fields, over-remaining amounts, other students' enrollments", async () => {
    const { student, enrollment, otherEnrollment } = await setup();
    const id = enrollment._id.toString();

    for (const extra of <Record<string, string | number>[]>[
      { status: "APPROVED" },
      { amountPaid: 50000 },
      { remainingAmount: 0 },
      { studentId: otherEnrollment.student.toString() },
    ]) {
      const res = await submit(student.token, { enrollmentId: id, amount: 1000, ...extra });
      expect(res.status).toBe(422);
    }

    expect((await submit(student.token, { enrollmentId: id, amount: 10001 })).status).toBe(400);
    expect((await submit(student.token, { enrollmentId: id, amount: 0 })).status).toBe(422);
    expect((await submit(student.token, { enrollmentId: id, amount: -5 })).status).toBe(422);
    expect((await submit(student.token, { enrollmentId: id, amount: 10.555 })).status).toBe(422);

    // Someone else's enrollment → indistinguishable from nonexistent.
    const foreign = await submit(student.token, { enrollmentId: otherEnrollment._id.toString(), amount: 1000 });
    expect(foreign.status).toBe(404);

    expect(await PaymentRequest.countDocuments()).toBe(0);
  });

  it("validates the screenshot server-side (missing, wrong type, spoofed content, oversized)", async () => {
    const { student, enrollment } = await setup();
    const fields = { enrollmentId: enrollment._id.toString(), amount: 1000 };

    expect((await submit(student.token, fields, null)).status).toBe(400);
    expect((await submit(student.token, fields, { buf: PNG, name: "proof.gif", type: "image/gif" })).status).toBe(400);
    expect(
      (await submit(student.token, fields, { buf: Buffer.from("<script>alert(1)</script>"), name: "proof.png", type: "image/png" })).status
    ).toBe(400);
    expect((await submit(student.token, fields, { buf: PNG, name: "proof.jpg", type: "image/png" })).status).toBe(400);
    const big = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]);
    const oversized = await submit(student.token, fields, { buf: big, name: "proof.png", type: "image/png" });
    expect(oversized.status).toBe(400);
    expect(oversized.body.message).toContain("5MB");

    expect(await PaymentRequest.countDocuments()).toBe(0);
  });

  it("enforces role and ownership on every payment endpoint", async () => {
    const { student, other, enrollment } = await setup();
    const created = await submit(student.token, { enrollmentId: enrollment._id.toString(), amount: 1000 });
    const id = created.body.data._id;

    // Unauthenticated.
    expect((await request(app).get("/api/v1/fees/my-status")).status).toBe(401);
    expect((await request(app).post("/api/v1/fees/payment-requests")).status).toBe(401);

    // Students can't use admin endpoints.
    for (const [method, url] of [
      ["get", "/api/v1/fees/payment-requests"],
      ["get", `/api/v1/fees/payment-requests/${id}`],
      ["patch", `/api/v1/fees/payment-requests/${id}/approve`],
      ["patch", `/api/v1/fees/payment-requests/${id}/reject`],
      ["put", "/api/v1/fees/payment-settings/qr-code"],
    ] as const) {
      const res = await request(app)[method](url).set(authHeader(student.token)).send({ reason: "whatever reason" });
      expect(res.status).toBe(403);
    }
    expect(await PaymentRequest.countDocuments({ status: "PENDING" })).toBe(1);

    // Screenshots: own → image; someone else's → 404.
    const own = await request(app).get(`/api/v1/fees/payment-requests/${id}/screenshot`).set(authHeader(student.token));
    expect(own.status).toBe(200);
    expect(own.headers["content-type"]).toContain("image/png");
    expect(own.headers["cache-control"]).toContain("no-store");

    const foreign = await request(app).get(`/api/v1/fees/payment-requests/${id}/screenshot`).set(authHeader(other.token));
    expect(foreign.status).toBe(404);

    // Other students don't see it in their own history either.
    const otherHistory = await request(app).get("/api/v1/fees/my-payment-requests").set(authHeader(other.token));
    expect(otherHistory.body.data).toHaveLength(0);
  });

  it("partial approval → ledger entry, recalculated balance, still PENDING, student notified", async () => {
    const { student, admin, enrollment } = await setup();
    const created = await submit(student.token, { enrollmentId: enrollment._id.toString(), amount: 4000 });
    const id = created.body.data._id;

    const viewed = await request(app).get(`/api/v1/fees/payment-requests/${id}`).set(authHeader(admin.token));
    expect(viewed.status).toBe(200);
    expect(viewed.body.data.currentBalance).toEqual({ finalFee: 10000, amountPaid: 0, amountDue: 10000 });
    const shot = await request(app).get(`/api/v1/fees/payment-requests/${id}/screenshot`).set(authHeader(admin.token));
    expect(shot.status).toBe(200);

    const res = await request(app).patch(`/api/v1/fees/payment-requests/${id}/approve`).set(authHeader(admin.token)).send({});
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      status: "APPROVED",
      approvedAmount: 4000,
      paidAfterApproval: 4000,
      remainingAfterApproval: 6000,
      reviewedByName: "Admin One",
    });
    expect(res.body.data.reviewedBy).toBe(admin.user._id.toString());

    const ledger = await Payment.find({ paymentRequest: id });
    expect(ledger).toHaveLength(1);
    expect(ledger[0].amount).toBe(4000);

    expect(await myStatus(student.token)).toMatchObject({
      paymentStatus: "PENDING",
      canPay: true,
      amountPaid: 4000,
      amountDue: 6000,
      status: "PARTIALLY_PAID",
    });

    const note = await Notification.findOne({ user: student.user._id, type: "PAYMENT_APPROVED" });
    expect(note?.title).toBe("Payment Approved");
    expect(note?.message).toContain("Remaining: ₹6,000");

  });

  it("gives admins (only) the registered phone needed for the Send WhatsApp button", async () => {
    const { student, admin, enrollment } = await setup();
    const created = await submit(student.token, { enrollmentId: enrollment._id.toString(), amount: 4000 });
    const id = created.body.data._id;
    await request(app).patch(`/api/v1/fees/payment-requests/${id}/approve`).set(authHeader(admin.token)).send({});

    // Admin Payment History and Verification lists carry the number from the User record.
    const history = await request(app).get("/api/v1/fees/payments").set(authHeader(admin.token));
    expect(history.status).toBe(200);
    expect(history.body.data[0].student).toMatchObject({ name: "Asha Student", phone: student.user.phone });

    const verification = await request(app)
      .get("/api/v1/fees/payment-requests?status=APPROVED")
      .set(authHeader(admin.token));
    expect(verification.body.data[0].student).toMatchObject({ phone: student.user.phone });

    // Students can't reach the admin lists, and their own history doesn't carry the phone.
    expect((await request(app).get("/api/v1/fees/payments").set(authHeader(student.token))).status).toBe(403);
    expect((await request(app).get("/api/v1/fees/payment-requests").set(authHeader(student.token))).status).toBe(403);
    const mine = await request(app).get("/api/v1/fees/my-payments").set(authHeader(student.token));
    expect(mine.body.data[0].student.phone).toBeUndefined();

    // Reading these lists never touches payment state.
    expect(await Payment.countDocuments({ paymentRequest: id })).toBe(1);
    expect((await PaymentRequest.findById(id))?.status).toBe("APPROVED");
  });

  it("full approval → PAID, no more submissions; history keeps every payment", async () => {
    const { student, admin, enrollment } = await setup();
    const eid = enrollment._id.toString();

    for (const amount of [4999.71, 3000.29, 2000]) {
      const created = await submit(student.token, { enrollmentId: eid, amount });
      expect(created.status).toBe(201);
      const approved = await request(app)
        .patch(`/api/v1/fees/payment-requests/${created.body.data._id}/approve`)
        .set(authHeader(admin.token))
        .send({});
      expect(approved.status).toBe(200);
    }

    expect(await myStatus(student.token)).toMatchObject({ paymentStatus: "PAID", canPay: false, amountDue: 0 });
    expect((await submit(student.token, { enrollmentId: eid, amount: 1 })).status).toBe(409);

    const history = await request(app).get("/api/v1/fees/my-payment-requests").set(authHeader(student.token));
    expect(history.body.data.map((r: { amount: number }) => r.amount).sort()).toEqual([2000, 3000.29, 4999.71]);
    expect(history.body.data[0].reviewedByName).toBe("Admin One");
    expect(history.body.data[0].reviewedBy).toBeUndefined();
    expect(await Payment.countDocuments({ student: student.user._id })).toBe(3);

    const note = await Notification.findOne({ user: student.user._id, title: "Course Fee Fully Paid" });
    expect(note).not.toBeNull();
  });

  it("approval automatically emails the student's registered address; rejection doesn't; a mail failure never blocks approval", async () => {
    const { student, admin, enrollment, batch } = await setup();
    const eid = enrollment._id.toString();
    const spy = jest.spyOn(emailService, "sendPaymentApproved").mockResolvedValue(true);
    try {
      const first = await submit(student.token, { enrollmentId: eid, amount: 4000 });
      const approved = await request(app)
        .patch(`/api/v1/fees/payment-requests/${first.body.data._id}/approve`)
        .set(authHeader(admin.token))
        .send({ amount: 3500 });
      expect(approved.status).toBe(200);
      expect(approved.body.data.studentEmailSent).toBe(true);

      const receipt = await Payment.findOne({ paymentRequest: first.body.data._id });
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(
        student.user.email,
        expect.objectContaining({
          name: "Asha Student",
          courseName: "MERN Full Stack",
          batchName: batch.name,
          amount: 3500,
          paidAfterApproval: 3500,
          remainingAfterApproval: 6500,
          receiptNumber: receipt?.receiptNumber,
        })
      );

      // Rejections never send the approval email.
      const second = await submit(student.token, { enrollmentId: eid, amount: 1000 });
      await request(app)
        .patch(`/api/v1/fees/payment-requests/${second.body.data._id}/reject`)
        .set(authHeader(admin.token))
        .send({ reason: "Screenshot is unreadable." });
      expect(spy).toHaveBeenCalledTimes(1);

      // SMTP down / not configured: still approved, admin is told the email didn't go out.
      spy.mockRejectedValueOnce(new Error("SMTP unreachable"));
      const third = await submit(student.token, { enrollmentId: eid, amount: 1000 });
      const res = await request(app)
        .patch(`/api/v1/fees/payment-requests/${third.body.data._id}/approve`)
        .set(authHeader(admin.token))
        .send({});
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ status: "APPROVED", studentEmailSent: false });
      expect(await Payment.countDocuments({ paymentRequest: third.body.data._id })).toBe(1);
    } finally {
      spy.mockRestore();
    }
  });

  it("cash payment recorded by an admin: capped at the remaining fee, notifies and emails the student", async () => {
    const { student, admin, batch } = await setup();
    const spy = jest.spyOn(emailService, "sendPaymentRecorded").mockResolvedValue(true);
    const record = (token: string, body: Record<string, unknown>) =>
      request(app).post("/api/v1/fees/payments").set(authHeader(token)).send(body);
    const base = { student: student.user._id.toString(), batch: batch._id.toString(), paymentMethod: "CASH" };
    try {
      // Only admins can record payments.
      expect((await record(student.token, { ...base, amount: 1000 })).status).toBe(403);

      // More than the outstanding fee is refused and nothing is written.
      const tooMuch = await record(admin.token, { ...base, amount: 10000.01 });
      expect(tooMuch.status).toBe(400);
      expect(tooMuch.body.message).toContain("remaining fee of ₹10,000");
      expect((await record(admin.token, { ...base, amount: 100.555 })).status).toBe(422);
      expect(await Payment.countDocuments()).toBe(0);

      const partial = await record(admin.token, { ...base, amount: 4000, transactionRef: "Receipt book #12" });
      expect(partial.status).toBe(201);
      expect(partial.body.data).toMatchObject({
        paymentMethod: "CASH",
        amount: 4000,
        paidAfterPayment: 4000,
        remainingAfterPayment: 6000,
        studentEmailSent: true,
      });
      expect(spy).toHaveBeenCalledWith(
        student.user.email,
        expect.objectContaining({
          name: "Asha Student",
          paymentMethod: "CASH",
          amount: 4000,
          paidAfterApproval: 4000,
          remainingAfterApproval: 6000,
          receiptNumber: partial.body.data.receiptNumber,
        })
      );
      const note = await Notification.findOne({ user: student.user._id, type: "PAYMENT_RECORDED" });
      expect(note?.title).toBe("Payment Received");
      expect(note?.message).toContain("cash payment of ₹4,000");
      expect(await myStatus(student.token)).toMatchObject({ amountPaid: 4000, amountDue: 6000, status: "PARTIALLY_PAID" });

      // Concurrent entries by two admins can't overshoot the fee together.
      const [a, b] = await Promise.all([
        record(admin.token, { ...base, amount: 6000 }),
        record(admin.token, { ...base, amount: 6000 }),
      ]);
      expect([a.status, b.status].sort()).toEqual([201, 409]);
      expect(await myStatus(student.token)).toMatchObject({ amountDue: 0, status: "PAID" });
      expect(await Notification.findOne({ user: student.user._id, title: "Course Fee Fully Paid" })).not.toBeNull();

      // Fully paid: further payments are refused.
      expect((await record(admin.token, { ...base, amount: 1 })).status).toBe(409);
    } finally {
      spy.mockRestore();
    }
  });

  it("recording a cash payment still succeeds when the email can't be sent", async () => {
    const { student, admin, batch } = await setup();
    const spy = jest.spyOn(emailService, "sendPaymentRecorded").mockRejectedValue(new Error("SMTP unreachable"));
    try {
      const res = await request(app)
        .post("/api/v1/fees/payments")
        .set(authHeader(admin.token))
        .send({ student: student.user._id.toString(), batch: batch._id.toString(), paymentMethod: "CASH", amount: 2500 });
      expect(res.status).toBe(201);
      expect(res.body.data.studentEmailSent).toBe(false);
      expect(await Payment.countDocuments({ student: student.user._id })).toBe(1);
    } finally {
      spy.mockRestore();
    }
  });

  it("rejection requires a reason, notifies the student, and allows resubmission", async () => {
    const { student, admin, enrollment } = await setup();
    const eid = enrollment._id.toString();
    const created = await submit(student.token, { enrollmentId: eid, amount: 4000 });
    const id = created.body.data._id;

    const noReason = await request(app).patch(`/api/v1/fees/payment-requests/${id}/reject`).set(authHeader(admin.token)).send({});
    expect(noReason.status).toBe(422);

    const res = await request(app)
      .patch(`/api/v1/fees/payment-requests/${id}/reject`)
      .set(authHeader(admin.token))
      .send({ reason: "Payment screenshot is unclear." });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: "REJECTED", rejectionReason: "Payment screenshot is unclear." });
    expect(await Payment.countDocuments()).toBe(0);

    const status = await myStatus(student.token);
    expect(status).toMatchObject({ paymentStatus: "REJECTED", canPay: true, amountPaid: 0 });
    expect(status.lastRejection.reason).toBe("Payment screenshot is unclear.");

    const note = await Notification.findOne({ user: student.user._id, type: "PAYMENT_REJECTED" });
    expect(note?.title).toBe("Payment Verification Failed");
    expect(note?.message).toContain("Payment screenshot is unclear.");

    // A processed request can't be processed again, either way.
    expect((await request(app).patch(`/api/v1/fees/payment-requests/${id}/approve`).set(authHeader(admin.token)).send({})).status).toBe(409);

    expect((await submit(student.token, { enrollmentId: eid, amount: 4000 })).status).toBe(201);
  });

  it("two admins processing the same payment → exactly one state transition", async () => {
    const { student, admin, admin2, enrollment } = await setup();
    const created = await submit(student.token, { enrollmentId: enrollment._id.toString(), amount: 4000 });
    const id = created.body.data._id;

    const [a, b] = await Promise.all([
      request(app).patch(`/api/v1/fees/payment-requests/${id}/approve`).set(authHeader(admin.token)).send({}),
      request(app).patch(`/api/v1/fees/payment-requests/${id}/approve`).set(authHeader(admin2.token)).send({}),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect(await Payment.countDocuments({ paymentRequest: id })).toBe(1);

    // Approve-vs-reject race on a fresh request.
    const second = await submit(student.token, { enrollmentId: enrollment._id.toString(), amount: 1000 });
    const id2 = second.body.data._id;
    const [c, d] = await Promise.all([
      request(app).patch(`/api/v1/fees/payment-requests/${id2}/approve`).set(authHeader(admin.token)).send({}),
      request(app).patch(`/api/v1/fees/payment-requests/${id2}/reject`).set(authHeader(admin2.token)).send({ reason: "Could not verify amount" }),
    ]);
    expect([c.status, d.status].sort()).toEqual([200, 409]);
    const final = await PaymentRequest.findById(id2);
    expect(await Payment.countDocuments({ paymentRequest: id2 })).toBe(final?.status === "APPROVED" ? 1 : 0);
  });

  it("re-validates against current DB state at approval time (fee change, manual payment, removed enrollment)", async () => {
    const { student, admin, enrollment, batch, course } = await setup();
    const created = await submit(student.token, { enrollmentId: enrollment._id.toString(), amount: 8000 });
    const id = created.body.data._id;

    // Admin records a cash payment meanwhile, leaving only 5000 due.
    await Payment.create({
      student: student.user._id, course: course._id, batch: batch._id, amount: 5000,
      paymentMethod: "CASH", receiptNumber: "RCPT-TEST-1", recordedBy: admin.user._id,
    });
    const tooMuch = await request(app).patch(`/api/v1/fees/payment-requests/${id}/approve`).set(authHeader(admin.token)).send({});
    expect(tooMuch.status).toBe(409);
    expect((await PaymentRequest.findById(id))?.status).toBe("PENDING");

    // Admin approves the amount they could actually verify instead.
    const adjusted = await request(app)
      .patch(`/api/v1/fees/payment-requests/${id}/approve`)
      .set(authHeader(admin.token))
      .send({ amount: 5000 });
    expect(adjusted.status).toBe(200);
    expect(adjusted.body.data).toMatchObject({ amount: 8000, approvedAmount: 5000, remainingAfterApproval: 0 });

    // Enrollment removed while a request is pending → can't approve, can reject.
    const { student: s2, enrollment: e2 } = await (async () => {
      const s = await createUser({ role: "STUDENT" });
      const e = await Enrollment.create({ student: s.user._id, batch: batch._id, course: course._id });
      return { student: s, enrollment: e };
    })();
    const pending = await submit(s2.token, { enrollmentId: e2._id.toString(), amount: 1000 });
    await Enrollment.deleteOne({ _id: e2._id });
    const pid = pending.body.data._id;
    expect((await request(app).patch(`/api/v1/fees/payment-requests/${pid}/approve`).set(authHeader(admin.token)).send({})).status).toBe(409);
    expect(
      (await request(app).patch(`/api/v1/fees/payment-requests/${pid}/reject`).set(authHeader(admin.token)).send({ reason: "Enrollment was cancelled" })).status
    ).toBe(200);
  });

  it("QR code: placeholder until an admin uploads one; replaceable without frontend changes", async () => {
    const { student, admin } = await setup();

    const initial = await request(app).get("/api/v1/fees/payment-settings").set(authHeader(student.token));
    expect(initial.body.data.qrCode.available).toBe(false);
    expect((await request(app).get("/api/v1/fees/payment-settings/qr-code").set(authHeader(student.token))).status).toBe(404);

    const upload = await request(app)
      .put("/api/v1/fees/payment-settings/qr-code")
      .set(authHeader(admin.token))
      .attach("qrCode", PNG, { filename: "qr.png", contentType: "image/png" });
    expect(upload.status).toBe(200);
    expect(upload.body.data.qrCode.available).toBe(true);
    expect(JSON.stringify(upload.body)).not.toContain("payment-qr/");

    const image = await request(app).get("/api/v1/fees/payment-settings/qr-code").set(authHeader(student.token));
    expect(image.status).toBe(200);
    expect(image.headers["content-type"]).toContain("image/png");

    const removed = await request(app).delete("/api/v1/fees/payment-settings/qr-code").set(authHeader(admin.token));
    expect(removed.body.data.qrCode.available).toBe(false);
  });
});
