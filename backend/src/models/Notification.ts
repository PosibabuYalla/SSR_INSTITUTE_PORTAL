import { Schema, model, Document, Types } from "mongoose";

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

export interface INotification extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  read: boolean;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: {
      type: String,
      enum: [
        "ACCOUNT_APPROVED",
        "ACCOUNT_REJECTED",
        "TASK_PUBLISHED",
        "SUBMISSION_EVALUATED",
        "INTERVIEW_SCHEDULED",
        "CERTIFICATE_ISSUED",
        "APPLICATION_STATUS_CHANGED",
        "ANNOUNCEMENT",
        "PAYMENT_SUBMITTED",
        "PAYMENT_APPROVED",
        "PAYMENT_REJECTED",
        "PAYMENT_RECORDED",
      ],
      required: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    message: { type: String, required: true, trim: true, maxlength: 1000 },
    link: { type: String, trim: true },
    read: { type: Boolean, default: false, index: true },
    readAt: { type: Date },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, read: 1, createdAt: -1 });

export const Notification = model<INotification>("Notification", notificationSchema);
