import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { attendanceService } from "@/services/attendance.service";
import { extractErrorMessage } from "@/lib/api-client";
import { MarkAttendanceInput } from "@/types/attendance";

const KEY = "attendance";

export function useAttendance(batch: string, date?: string) {
  return useQuery({
    queryKey: [KEY, batch, date],
    queryFn: () => attendanceService.list(batch, date),
    enabled: !!batch,
  });
}

export function useAttendanceSummary(batchId: string | null) {
  return useQuery({
    queryKey: [KEY, "summary", batchId],
    queryFn: () => attendanceService.getSummary(batchId as string),
    enabled: !!batchId,
  });
}

export function useMarkAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: MarkAttendanceInput) => attendanceService.mark(input),
    onSuccess: () => {
      toast.success("Attendance saved");
      queryClient.invalidateQueries({ queryKey: [KEY] });
      queryClient.invalidateQueries({ queryKey: ["student-dashboard"] });
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });
}
