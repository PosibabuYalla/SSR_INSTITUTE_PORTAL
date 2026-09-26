import { z } from "zod";
import { searchText } from "./common";

const OBJECT_ID = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");
const PAYMENT_METHODS = ["CASH", "CARD", "UPI", "BANK_TRANSFER", "OTHER"] as const;
const PAYMENT_STATUSES = ["PAID", "PARTIALLY_PAID", "PENDING"] as const;

/** Money in rupees: positive, finite, at most 2 decimal places. Used by every write that moves money. */
const RUPEE_AMOUNT = z.coerce
  .number()
  .finite()
  .positive("Amount must be greater than zero")
  .max(10_000_000, "Amount is too large")
  // Tolerance, not ===, so values like 0.29 (28.999…96 after ×100) aren't wrongly rejected.
  .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, "Amount can have at most 2 decimal places");

export const recordPaymentSchema = z.object({
  student: OBJECT_ID,
  batch: OBJECT_ID,
  amount: RUPEE_AMOUNT,
  paymentDate: z.coerce.date().optional(),
  paymentMethod: z.enum(PAYMENT_METHODS),
  transactionRef: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(500).optional(),
});

export const updateDiscountSchema = z.object({
  discount: z.coerce.number().min(0, "Discount cannot be negative"),
});

export const listPaymentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: searchText.optional(),
  batch: OBJECT_ID.optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  sortBy: z.enum(["createdAt", "paymentDate", "amount"]).default("paymentDate"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const listFeeStatusQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: searchText.optional(),
  batch: OBJECT_ID.optional(),
  status: z.enum(PAYMENT_STATUSES).optional(),
});

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
export type ListPaymentsQuery = z.infer<typeof listPaymentsQuerySchema>;
export type ListFeeStatusQuery = z.infer<typeof listFeeStatusQuerySchema>;

// --- Screenshot payment verification ---------------------------------------------------------
// `.strict()` on every client-writable shape: a payload carrying anything else (status,
// amountPaid, remainingAmount, studentId, verifiedBy, ...) is rejected outright rather than
// silently stripped, so tampering is visible and never half-applied.

const PAYMENT_REQUEST_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
/** Multipart text fields that accompany the screenshot. */
export const submitPaymentRequestSchema = z
  .object({
    enrollmentId: OBJECT_ID,
    amount: RUPEE_AMOUNT,
  })
  .strict();

export const approvePaymentRequestSchema = z
  .object({
    /** Optional: the amount the admin actually verified, if it differs from the student's claim. */
    amount: RUPEE_AMOUNT.optional(),
  })
  .strict();

export const rejectPaymentRequestSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(5, "Please give a reason of at least 5 characters")
      .max(500, "Reason must be 500 characters or fewer"),
  })
  .strict();

export const listPaymentRequestsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  status: z.enum(PAYMENT_REQUEST_STATUSES).optional(),
  search: z.string().trim().max(100).optional(),
});

export const paymentRequestIdParamsSchema = z.object({ id: OBJECT_ID });

export type SubmitPaymentRequestInput = z.infer<typeof submitPaymentRequestSchema>;
export type ApprovePaymentRequestInput = z.infer<typeof approvePaymentRequestSchema>;
export type RejectPaymentRequestInput = z.infer<typeof rejectPaymentRequestSchema>;
export type ListPaymentRequestsQuery = z.infer<typeof listPaymentRequestsQuerySchema>;
