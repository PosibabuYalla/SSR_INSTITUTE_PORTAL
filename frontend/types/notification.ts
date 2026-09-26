export type NotificationType =
  | "ACCOUNT_APPROVED"
  | "ACCOUNT_REJECTED"
  | "TASK_PUBLISHED"
  | "SUBMISSION_EVALUATED"
  | "INTERVIEW_SCHEDULED"
  | "CERTIFICATE_ISSUED"
  | "APPLICATION_STATUS_CHANGED"
  | "ANNOUNCEMENT"
  | "PAYMENT_SUBMITTED"
  | "PAYMENT_APPROVED"
  | "PAYMENT_REJECTED"
  | "PAYMENT_RECORDED";

export interface AppNotification {
  _id: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  read: boolean;
  readAt?: string;
  createdAt: string;
}
