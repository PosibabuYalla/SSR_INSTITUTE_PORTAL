import mongoose, { FilterQuery, Types } from "mongoose";
import { PaymentRequest, IPaymentRequest } from "../models/PaymentRequest";
import { Payment } from "../models/Payment";
import { User } from "../models/User";
import { Role } from "../constants/enums";
import { ApiError } from "../utils/ApiError";
import { logger } from "../utils/logger";
import { assertValidImage } from "../utils/imageValidation";
import { MAX_PAYMENT_IMAGE_BYTES } from "../middleware/upload";
import { recordAudit } from "./auditLog.service";
import { notifyUser, notifyUsers } from "./notification.service";
import { emailService } from "./email.service";
import { Batch } from "../models/Batch";
import { deletePrivateFile, readPrivateFile, uploadPrivateImage } from "./upload.service";
import { generateReceiptNumber, getEnrollmentBalance, roundMoney } from "./fee.service";
import {
  ApprovePaymentRequestInput,
  ListPaymentRequestsQuery,
  SubmitPaymentRequestInput,
} from "../validators/fee.validator";

const ADMIN_VERIFICATION_LINK = "/admin/fees?tab=verification";
const STUDENT_FEES_LINK = "/student/fees";

function formatInr(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: number }).code === 11000;
}

/** Notifications are a side effect of an already-committed state change — failing to send one
 * must not turn a successful submission/review into an error response (which would invite a
 * confused retry). */
async function safeNotify(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (error) {
    logger.error("Failed to create payment notification", error);
  }
}

async function alreadyProcessedError(id: string): Promise<ApiError> {
  const existing = await PaymentRequest.findById(id).select("status reviewedByName").lean();
  if (!existing) return ApiError.notFound("Payment request not found");
  const by = existing.reviewedByName ? ` by ${existing.reviewedByName}` : "";
  return ApiError.conflict(`This payment has already been ${existing.status.toLowerCase()}${by}`);
}

// ---------------------------------------------------------------------------------------------
// Student
// ---------------------------------------------------------------------------------------------

export async function submitPaymentRequest(
  studentId: string,
  input: SubmitPaymentRequestInput,
  file: Express.Multer.File | undefined
) {
  if (!file) throw ApiError.badRequest("Please attach a payment screenshot");

  const student = await User.findOne({ _id: studentId, role: "STUDENT" }).select("name").lean();
  if (!student) throw ApiError.forbidden("Only students can submit fee payments");

  // Ownership is enforced here: the enrollment must belong to the authenticated student.
  const balance = await getEnrollmentBalance(input.enrollmentId, { studentId });
  const { enrollment, course, finalFee, amountPaid, amountDue } = balance;

  if (amountDue <= 0) throw ApiError.conflict("The fee for this course is already fully paid");

  const pending = await PaymentRequest.exists({ enrollment: enrollment._id, status: "PENDING" });
  if (pending) {
    throw ApiError.conflict("A payment for this course is already under review");
  }

  if (input.amount > amountDue) {
    throw ApiError.badRequest(`Amount cannot exceed the remaining fee of ${formatInr(amountDue)}`);
  }

  const mimeType = assertValidImage(file, MAX_PAYMENT_IMAGE_BYTES);
  const stored = await uploadPrivateImage(file.buffer, mimeType, "payment-screenshots");

  let request: IPaymentRequest;
  try {
    request = await PaymentRequest.create({
      student: studentId,
      studentName: student.name,
      enrollment: enrollment._id,
      batch: enrollment.batch,
      course: course._id,
      courseName: course.name,
      totalFee: finalFee,
      previousPaidAmount: amountPaid,
      amountDueAtSubmission: amountDue,
      amount: input.amount,
      screenshot: stored,
      status: "PENDING",
      submittedAt: new Date(),
    });
  } catch (error) {
    await deletePrivateFile(stored);
    // Lost a race with a concurrent submission — the partial unique index caught it.
    if (isDuplicateKeyError(error)) {
      throw ApiError.conflict("A payment for this course is already under review");
    }
    throw error;
  }

  await recordAudit({
    userId: studentId,
    action: "PAYMENT_REQUEST_SUBMITTED",
    entity: "PaymentRequest",
    entityId: request._id,
    metadata: { enrollment: enrollment._id, course: course._id, amount: input.amount },
  });

  await safeNotify(async () => {
    const admins = await User.find({ role: "ADMIN", status: "ACTIVE" }).select("_id").lean();
    await notifyUsers(
      admins.map((a) => String(a._id)),
      {
        type: "PAYMENT_SUBMITTED",
        title: "New Payment Verification Required",
        message: `${student.name} submitted a payment screenshot of ${formatInr(input.amount)} for ${course.name}.`,
        link: ADMIN_VERIFICATION_LINK,
      }
    );
  });

  return toPublicRequest(request.toObject());
}

/** A student's own submission history (admin identity reduced to a display name). */
export async function listMyPaymentRequests(studentId: string) {
  const requests = await PaymentRequest.find({ student: studentId })
    .select("-reviewedBy")
    .populate("batch", "name")
    .sort({ createdAt: -1 })
    .lean();
  return requests.map(toPublicRequest);
}

// ---------------------------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------------------------

export async function listPaymentRequests(query: ListPaymentRequestsQuery) {
  const filter: FilterQuery<IPaymentRequest> = {};
  if (query.status) filter.status = query.status;
  if (query.search) {
    const regex = new RegExp(escapeRegex(query.search), "i");
    filter.$or = [{ studentName: regex }, { courseName: regex }];
  }

  const skip = (query.page - 1) * query.limit;
  const [requests, total] = await Promise.all([
    PaymentRequest.find(filter)
      .populate("student", "name email phone") // admin-only (GET /fees/payment-requests)
      .populate("batch", "name")
      // Pending first-in-first-out; reviewed ones newest first.
      .sort(query.status === "PENDING" ? { createdAt: 1 } : { createdAt: -1 })
      .skip(skip)
      .limit(query.limit)
      .lean(),
    PaymentRequest.countDocuments(filter),
  ]);
  return { requests: requests.map(toPublicRequest), total };
}

export async function getPaymentRequest(id: string) {
  const request = await PaymentRequest.findById(id)
    .populate("student", "name email phone")
    .populate("batch", "name")
    .lean();
  if (!request) throw ApiError.notFound("Payment request not found");

  // Everything this enrollment has ever submitted, so the reviewer sees prior attempts.
  const history = await PaymentRequest.find({ enrollment: request.enrollment })
    .sort({ createdAt: -1 })
    .lean();

  let currentBalance: { finalFee: number; amountPaid: number; amountDue: number } | null = null;
  try {
    const b = await getEnrollmentBalance(request.enrollment);
    currentBalance = { finalFee: b.finalFee, amountPaid: b.amountPaid, amountDue: b.amountDue };
  } catch (error) {
    // Enrollment or course removed since submission — still reviewable (rejectable).
    if (!(error instanceof ApiError)) throw error;
  }

  return { ...toPublicRequest(request), currentBalance, history: history.map(toPublicRequest) };
}

/**
 * PENDING → APPROVED, inside a transaction: the conditional status flip and the `Payment`
 * ledger insert commit together or not at all. Concurrency: the update only matches while the
 * request is still PENDING, so if two admins race, one transaction commits and the other either
 * matches nothing or hits a write conflict, is retried by `withTransaction`, then sees the
 * request is no longer PENDING and gets a 409.
 */
export async function approvePaymentRequest(
  adminId: string,
  id: string,
  input: ApprovePaymentRequestInput
) {
  const admin = await User.findOne({ _id: adminId, role: "ADMIN" }).select("name").lean();
  if (!admin) throw ApiError.forbidden("Only admins can verify payments");

  const session = await mongoose.startSession();
  let approved: IPaymentRequest | null = null;
  try {
    await session.withTransaction(async () => {
      const request = await PaymentRequest.findById(id).session(session);
      if (!request) throw ApiError.notFound("Payment request not found");
      if (request.status !== "PENDING") throw await alreadyProcessedError(id);

      let balance;
      try {
        balance = await getEnrollmentBalance(request.enrollment, { session });
      } catch (error) {
        if (error instanceof ApiError && error.statusCode === 404) {
          throw ApiError.conflict(
            "This student is no longer enrolled in this batch — reject the request instead"
          );
        }
        throw error;
      }

      // Re-validated against *current* DB state: the fee, discount, or other payments may have
      // changed since the student submitted.
      const approvedAmount = input.amount ?? request.amount;
      if (balance.amountDue <= 0) {
        throw ApiError.conflict("This fee is already fully paid — reject the request instead");
      }
      if (approvedAmount > balance.amountDue) {
        throw ApiError.conflict(
          `Approved amount ${formatInr(approvedAmount)} exceeds the current remaining fee of ${formatInr(balance.amountDue)}`
        );
      }

      const paidAfter = roundMoney(balance.amountPaid + approvedAmount);
      const remainingAfter = roundMoney(Math.max(0, balance.finalFee - paidAfter));
      const paymentId = new Types.ObjectId();
      const now = new Date();

      approved = await PaymentRequest.findOneAndUpdate(
        { _id: id, status: "PENDING" },
        {
          $set: {
            status: "APPROVED",
            approvedAmount,
            paidAfterApproval: paidAfter,
            remainingAfterApproval: remainingAfter,
            reviewedBy: adminId,
            reviewedByName: admin.name,
            reviewedAt: now,
            payment: paymentId,
          },
        },
        { new: true, session }
      );
      if (!approved) throw await alreadyProcessedError(id);

      await Payment.create(
        [
          {
            _id: paymentId,
            student: request.student,
            course: request.course,
            batch: request.batch,
            amount: approvedAmount,
            paymentDate: request.submittedAt,
            paymentMethod: "UPI",
            transactionRef: `PR-${request._id}`,
            notes: "Verified from student-submitted payment screenshot",
            receiptNumber: generateReceiptNumber(),
            recordedBy: adminId,
            paymentRequest: request._id,
          },
        ],
        { session }
      );
    });
  } finally {
    await session.endSession();
  }

  const result = approved as unknown as IPaymentRequest;

  await recordAudit({
    userId: adminId,
    action: "PAYMENT_REQUEST_APPROVED",
    entity: "PaymentRequest",
    entityId: result._id,
    metadata: {
      student: result.student,
      amount: result.approvedAmount,
      claimedAmount: result.amount,
      payment: result.payment,
    },
  });

  await safeNotify(() =>
    notifyUser(String(result.student), {
      type: "PAYMENT_APPROVED",
      ...(result.remainingAfterApproval === 0
        ? {
            title: "Course Fee Fully Paid",
            message: `Your complete payment for ${result.courseName} has been verified. Paid: ${formatInr(result.paidAfterApproval ?? 0)}.`,
          }
        : {
            title: "Payment Approved",
            message: `Your payment of ${formatInr(result.approvedAmount ?? 0)} for ${result.courseName} has been verified. Paid: ${formatInr(result.paidAfterApproval ?? 0)} · Remaining: ${formatInr(result.remainingAfterApproval ?? 0)}.`,
          }),
      link: STUDENT_FEES_LINK,
    })
  );

  const studentEmailSent = await sendPaymentApprovedEmail(result);

  return { ...toPublicRequest(result.toObject()), studentEmailSent };
}

/** Emails the student's registered address after an approval has committed. Best-effort: a
 * failure is logged and reported back as `false`, never as an error. */
async function sendPaymentApprovedEmail(approved: IPaymentRequest): Promise<boolean> {
  try {
    const [student, payment, batch] = await Promise.all([
      User.findById(approved.student).select("name email").lean(),
      Payment.findById(approved.payment).select("receiptNumber paymentDate").lean(),
      Batch.findById(approved.batch).select("name").lean(),
    ]);
    if (!student?.email) return false;

    return await emailService.sendPaymentApproved(student.email, {
      name: student.name,
      courseName: approved.courseName,
      batchName: batch?.name,
      amount: approved.approvedAmount ?? approved.amount,
      paidAfterApproval: approved.paidAfterApproval ?? 0,
      remainingAfterApproval: approved.remainingAfterApproval ?? 0,
      receiptNumber: payment?.receiptNumber,
      paymentDate: payment?.paymentDate ?? approved.submittedAt,
    });
  } catch (error) {
    logger.error("Failed to send payment-approved email", error);
    return false;
  }
}

/** PENDING → REJECTED, as a single conditional update so it can't clobber an approval. */
export async function rejectPaymentRequest(adminId: string, id: string, reason: string) {
  const admin = await User.findOne({ _id: adminId, role: "ADMIN" }).select("name").lean();
  if (!admin) throw ApiError.forbidden("Only admins can verify payments");

  const rejected = await PaymentRequest.findOneAndUpdate(
    { _id: id, status: "PENDING" },
    {
      $set: {
        status: "REJECTED",
        rejectionReason: reason,
        reviewedBy: adminId,
        reviewedByName: admin.name,
        reviewedAt: new Date(),
      },
    },
    { new: true }
  );
  if (!rejected) throw await alreadyProcessedError(id);

  await recordAudit({
    userId: adminId,
    action: "PAYMENT_REQUEST_REJECTED",
    entity: "PaymentRequest",
    entityId: rejected._id,
    metadata: { student: rejected.student, amount: rejected.amount, reason },
  });

  await safeNotify(() =>
    notifyUser(String(rejected.student), {
      type: "PAYMENT_REJECTED",
      title: "Payment Verification Failed",
      message: `Your payment for ${rejected.courseName} could not be verified. Reason: ${reason}. Please submit a valid payment screenshot again.`,
      link: STUDENT_FEES_LINK,
    })
  );

  return toPublicRequest(rejected.toObject());
}

// ---------------------------------------------------------------------------------------------
// Screenshot access
// ---------------------------------------------------------------------------------------------

/** Admins can view any screenshot; a student only their own. Anything else is a 404 so the
 * existence of other students' requests isn't confirmed. */
export async function getScreenshot(requester: { id: string; role: Role }, id: string) {
  const filter: FilterQuery<IPaymentRequest> = { _id: id };
  if (requester.role === "STUDENT") filter.student = requester.id;
  else if (requester.role !== "ADMIN") throw ApiError.forbidden();

  const request = await PaymentRequest.findOne(filter).select("+screenshot").lean();
  if (!request) throw ApiError.notFound("Payment request not found");

  const buffer = await readPrivateFile(request.screenshot);
  return { buffer, mimeType: request.screenshot.mimeType };
}

// ---------------------------------------------------------------------------------------------

/** Response shape: never includes the storage reference — only a flag that a screenshot exists
 * (fetched separately through the authorized screenshot route). */
function toPublicRequest<T extends object>(request: T) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { screenshot, __v, ...rest } = request as T & { screenshot?: unknown; __v?: number };
  return { ...rest, hasScreenshot: true };
}
