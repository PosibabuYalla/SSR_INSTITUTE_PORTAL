export type PaymentMethod = "CASH" | "CARD" | "UPI" | "BANK_TRANSFER" | "OTHER";
export type FeeStatus = "PAID" | "PARTIALLY_PAID" | "PENDING";

interface NamedRef {
  _id: string;
  name: string;
}

export interface FeeStatusRow {
  enrollmentId: string;
  student: NamedRef & { email: string };
  batch: NamedRef;
  course: NamedRef & { fee: number };
  discount: number;
  finalFee: number;
  amountPaid: number;
  amountDue: number;
  status: FeeStatus;
}

export interface PaymentRecord {
  _id: string;
  /** `phone` (registered number) is only included by the admin payment list. */
  student: NamedRef & { email: string; phone?: string };
  batch: NamedRef;
  course: NamedRef;
  amount: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  transactionRef?: string;
  receiptNumber: string;
  notes?: string;
  createdAt: string;
}

export interface FeeStatusQuery {
  page: number;
  limit: number;
  search?: string;
  batch?: string;
  status?: FeeStatus;
}

export interface PaymentListQuery {
  page: number;
  limit: number;
  search?: string;
  batch?: string;
  paymentMethod?: PaymentMethod;
}

/** Response of POST /fees/payments. */
export interface RecordedPayment extends PaymentRecord {
  paidAfterPayment: number;
  remainingAfterPayment: number;
  studentEmailSent: boolean;
}

export interface RecordPaymentInput {
  student: string;
  batch: string;
  amount: number;
  paymentDate?: string;
  paymentMethod: PaymentMethod;
  transactionRef?: string;
  notes?: string;
}

/** Student-facing status including screenshot verification — computed by the backend. */
export type FeeDisplayStatus = "PAID" | "PENDING" | "PAYMENT_UNDER_REVIEW" | "REJECTED";
export type PaymentRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface MyFeeStatusRow extends FeeStatusRow {
  paymentStatus: FeeDisplayStatus;
  canPay: boolean;
  pendingRequest: { _id: string; amount: number; submittedAt: string } | null;
  lastRejection: { reason: string; rejectedAt?: string } | null;
}

export interface PaymentRequestRecord {
  _id: string;
  student: string | (NamedRef & { email: string; phone?: string });
  studentName: string;
  enrollment: string;
  batch: string | NamedRef;
  course: string;
  courseName: string;
  totalFee: number;
  previousPaidAmount: number;
  amountDueAtSubmission: number;
  amount: number;
  status: PaymentRequestStatus;
  submittedAt: string;
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  approvedAmount?: number;
  paidAfterApproval?: number;
  remainingAfterApproval?: number;
  rejectionReason?: string;
  hasScreenshot: boolean;
  /** Only on the approve response: whether the confirmation email reached the SMTP server. */
  studentEmailSent?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentRequestDetail extends PaymentRequestRecord {
  currentBalance: { finalFee: number; amountPaid: number; amountDue: number } | null;
  history: PaymentRequestRecord[];
}

export interface PaymentRequestListQuery {
  page: number;
  limit: number;
  status?: PaymentRequestStatus;
  search?: string;
}

export interface PaymentSettings {
  qrCode: { available: boolean; updatedAt: string | null };
}
