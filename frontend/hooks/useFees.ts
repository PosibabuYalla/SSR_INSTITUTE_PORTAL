import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { feeService } from "@/services/fee.service";
import { extractErrorMessage } from "@/lib/api-client";
import {
  FeeStatusQuery,
  PaymentListQuery,
  PaymentRequestListQuery,
  RecordPaymentInput,
} from "@/types/fee";

const FEES_KEY = "fees";

export function useFeeStatus(query: FeeStatusQuery, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: [FEES_KEY, "status", query],
    queryFn: () => feeService.listStatus(query),
    placeholderData: (previous) => previous,
    enabled: options.enabled ?? true,
  });
}

export function usePayments(query: PaymentListQuery) {
  return useQuery({
    queryKey: [FEES_KEY, "payments", query],
    queryFn: () => feeService.listPayments(query),
    placeholderData: (previous) => previous,
  });
}

export function usePaymentHistory(studentId: string | null, batchId: string | null) {
  return useQuery({
    queryKey: [FEES_KEY, "history", studentId, batchId],
    queryFn: () => feeService.getPaymentHistory(studentId as string, batchId as string),
    enabled: !!studentId && !!batchId,
  });
}

export function useMyFeeStatus() {
  return useQuery({
    queryKey: [FEES_KEY, "my-status"],
    queryFn: () => feeService.getMyStatus(),
  });
}

export function useMyPayments() {
  return useQuery({
    queryKey: [FEES_KEY, "my-payments"],
    queryFn: () => feeService.getMyPayments(),
  });
}

export function useRecordPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RecordPaymentInput) => feeService.recordPayment(input),
    onSuccess: (payment) => {
      if (payment.studentEmailSent) {
        toast.success("Payment recorded", { description: "A confirmation email was sent to the student." });
      } else {
        toast.success("Payment recorded");
        toast.warning("The confirmation email could not be sent.", {
          description: "The payment is still recorded. Check the server's SMTP settings, or notify the student by WhatsApp.",
        });
      }
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
    // Refetch either way so the remaining fee shown in the form is never stale after a 400/409.
    onSettled: () => queryClient.invalidateQueries({ queryKey: [FEES_KEY] }),
  });
}

export function useUpdateDiscount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ enrollmentId, discount }: { enrollmentId: string; discount: number }) =>
      feeService.updateDiscount(enrollmentId, discount),
    onSuccess: () => {
      toast.success("Discount updated");
      queryClient.invalidateQueries({ queryKey: [FEES_KEY] });
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });
}

// --- Screenshot payment verification ---------------------------------------------------------

/** Private images arrive as blobs (fetched with auth); a data URL can be cached by React Query
 * and rendered directly, with no object-URL lifecycle to manage. */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Could not read image"));
    reader.readAsDataURL(blob);
  });
}

export function usePaymentSettings() {
  return useQuery({
    queryKey: [FEES_KEY, "payment-settings"],
    queryFn: () => feeService.getPaymentSettings(),
  });
}

/** QR image, only fetched when the backend says one is configured — keyed on its update time so
 * a replaced QR is re-fetched. */
export function usePaymentQrCode(updatedAt: string | null | undefined, enabled: boolean) {
  return useQuery({
    queryKey: [FEES_KEY, "payment-qr", updatedAt],
    queryFn: async () => blobToDataUrl(await feeService.getPaymentQrCode()),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useMyPaymentRequests() {
  return useQuery({
    queryKey: [FEES_KEY, "my-payment-requests"],
    queryFn: () => feeService.getMyPaymentRequests(),
  });
}

export function useSubmitPaymentRequest() {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState(0);
  const mutation = useMutation({
    mutationFn: (input: { enrollmentId: string; amount: number; screenshot: File }) => {
      setProgress(0);
      return feeService.submitPaymentRequest(input, setProgress);
    },
    onSuccess: () => {
      toast.success("Payment screenshot submitted successfully.", {
        description: "Your payment is waiting for Admin verification.",
      });
    },
    // Refetch either way — on a 409 (e.g. already submitted from another device) the UI should
    // show the real server state, not the stale one.
    onSettled: () => queryClient.invalidateQueries({ queryKey: [FEES_KEY] }),
  });
  return { ...mutation, progress };
}

export function usePaymentRequests(query: PaymentRequestListQuery) {
  return useQuery({
    queryKey: [FEES_KEY, "payment-requests", query],
    queryFn: () => feeService.listPaymentRequests(query),
    placeholderData: (previous) => previous,
  });
}

export function usePaymentRequest(id: string | null) {
  return useQuery({
    queryKey: [FEES_KEY, "payment-request", id],
    queryFn: () => feeService.getPaymentRequest(id as string),
    enabled: !!id,
  });
}

export function usePaymentRequestScreenshot(id: string | null) {
  return useQuery({
    queryKey: [FEES_KEY, "payment-request-screenshot", id],
    queryFn: async () => blobToDataUrl(await feeService.getPaymentRequestScreenshot(id as string)),
    enabled: !!id,
    staleTime: Infinity,
  });
}

export function useApprovePaymentRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, amount }: { id: string; amount?: number }) =>
      feeService.approvePaymentRequest(id, amount),
    onSuccess: (request) => {
      if (request.studentEmailSent) {
        toast.success("Payment approved", { description: "A confirmation email was sent to the student." });
      } else {
        toast.success("Payment approved");
        toast.warning("The confirmation email could not be sent.", {
          description: "The payment is still approved. Check the server's SMTP settings, or notify the student by WhatsApp.",
        });
      }
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: [FEES_KEY] }),
  });
}

export function useRejectPaymentRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      feeService.rejectPaymentRequest(id, reason),
    onSuccess: () => toast.success("Payment rejected"),
    onError: (error) => toast.error(extractErrorMessage(error)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: [FEES_KEY] }),
  });
}

export function useReplacePaymentQrCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => feeService.replacePaymentQrCode(file),
    onSuccess: () => {
      toast.success("Payment QR code updated");
      queryClient.invalidateQueries({ queryKey: [FEES_KEY, "payment-settings"] });
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });
}

export function useRemovePaymentQrCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => feeService.removePaymentQrCode(),
    onSuccess: () => {
      toast.success("Payment QR code removed");
      queryClient.invalidateQueries({ queryKey: [FEES_KEY, "payment-settings"] });
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });
}
