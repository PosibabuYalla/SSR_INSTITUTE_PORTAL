import { apiClient } from "@/lib/api-client";
import { ApiSuccessResponse } from "@/types/auth";
import {
  FeeStatusQuery,
  FeeStatusRow,
  MyFeeStatusRow,
  PaymentListQuery,
  PaymentRecord,
  PaymentRequestDetail,
  PaymentRequestListQuery,
  PaymentRequestRecord,
  PaymentSettings,
  RecordedPayment,
  RecordPaymentInput,
} from "@/types/fee";

export const feeService = {
  async listStatus(query: FeeStatusQuery) {
    const { data } = await apiClient.get<ApiSuccessResponse<FeeStatusRow[]>>("/fees/status", {
      params: query,
    });
    return { rows: data.data, meta: data.meta! };
  },

  async listPayments(query: PaymentListQuery) {
    const { data } = await apiClient.get<ApiSuccessResponse<PaymentRecord[]>>("/fees/payments", {
      params: query,
    });
    return { payments: data.data, meta: data.meta! };
  },

  async recordPayment(input: RecordPaymentInput) {
    const { data } = await apiClient.post<ApiSuccessResponse<RecordedPayment>>("/fees/payments", input);
    return data.data;
  },

  async getPaymentHistory(studentId: string, batchId: string) {
    const { data } = await apiClient.get<ApiSuccessResponse<PaymentRecord[]>>(
      `/fees/payments/${studentId}/${batchId}`
    );
    return data.data;
  },

  async updateDiscount(enrollmentId: string, discount: number) {
    const { data } = await apiClient.patch<ApiSuccessResponse<unknown>>(
      `/fees/enrollments/${enrollmentId}/discount`,
      { discount }
    );
    return data.data;
  },

  async getMyStatus() {
    const { data } = await apiClient.get<ApiSuccessResponse<MyFeeStatusRow[]>>("/fees/my-status");
    return data.data;
  },

  async getMyPayments() {
    const { data } = await apiClient.get<ApiSuccessResponse<PaymentRecord[]>>("/fees/my-payments");
    return data.data;
  },

  // --- Screenshot payment verification ---

  /** Only the enrollment and the claimed amount are sent — fee, balance and status are always
   * determined by the backend. */
  async submitPaymentRequest(
    input: { enrollmentId: string; amount: number; screenshot: File },
    onUploadProgress?: (percent: number) => void
  ) {
    const formData = new FormData();
    formData.append("enrollmentId", input.enrollmentId);
    formData.append("amount", String(input.amount));
    formData.append("screenshot", input.screenshot);

    const { data } = await apiClient.post<ApiSuccessResponse<PaymentRequestRecord>>(
      "/fees/payment-requests",
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (e) => {
          if (onUploadProgress && e.total) onUploadProgress(Math.round((e.loaded / e.total) * 100));
        },
      }
    );
    return data.data;
  },

  async getMyPaymentRequests() {
    const { data } = await apiClient.get<ApiSuccessResponse<PaymentRequestRecord[]>>(
      "/fees/my-payment-requests"
    );
    return data.data;
  },

  async listPaymentRequests(query: PaymentRequestListQuery) {
    const { data } = await apiClient.get<ApiSuccessResponse<PaymentRequestRecord[]>>(
      "/fees/payment-requests",
      { params: query }
    );
    return { requests: data.data, meta: data.meta! };
  },

  async getPaymentRequest(id: string) {
    const { data } = await apiClient.get<ApiSuccessResponse<PaymentRequestDetail>>(
      `/fees/payment-requests/${id}`
    );
    return data.data;
  },

  /** Screenshots are private — fetched with the auth header as a blob, never via a public URL. */
  async getPaymentRequestScreenshot(id: string) {
    const { data } = await apiClient.get<Blob>(`/fees/payment-requests/${id}/screenshot`, {
      responseType: "blob",
    });
    return data;
  },

  async approvePaymentRequest(id: string, amount?: number) {
    const { data } = await apiClient.patch<ApiSuccessResponse<PaymentRequestRecord>>(
      `/fees/payment-requests/${id}/approve`,
      amount !== undefined ? { amount } : {}
    );
    return data.data;
  },

  async rejectPaymentRequest(id: string, reason: string) {
    const { data } = await apiClient.patch<ApiSuccessResponse<PaymentRequestRecord>>(
      `/fees/payment-requests/${id}/reject`,
      { reason }
    );
    return data.data;
  },

  async getPaymentSettings() {
    const { data } = await apiClient.get<ApiSuccessResponse<PaymentSettings>>("/fees/payment-settings");
    return data.data;
  },

  async getPaymentQrCode() {
    const { data } = await apiClient.get<Blob>("/fees/payment-settings/qr-code", {
      responseType: "blob",
    });
    return data;
  },

  async replacePaymentQrCode(file: File) {
    const formData = new FormData();
    formData.append("qrCode", file);
    const { data } = await apiClient.put<ApiSuccessResponse<PaymentSettings>>(
      "/fees/payment-settings/qr-code",
      formData,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
    return data.data;
  },

  async removePaymentQrCode() {
    const { data } = await apiClient.delete<ApiSuccessResponse<PaymentSettings>>(
      "/fees/payment-settings/qr-code"
    );
    return data.data;
  },
};
