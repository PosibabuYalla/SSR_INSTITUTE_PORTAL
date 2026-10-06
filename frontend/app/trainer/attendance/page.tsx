"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBatches, useBatchStudents } from "@/hooks/useBatches";
import { useAttendance, useAttendanceSummary, useMarkAttendance } from "@/hooks/useAttendance";
import { AttendanceStatus } from "@/types/attendance";

const STATUS_OPTIONS: AttendanceStatus[] = ["PRESENT", "ABSENT", "LATE", "LEAVE"];

function statusBadgeClassName(status: AttendanceStatus): string {
  switch (status) {
    case "PRESENT":
      return "bg-status-good/10 text-status-good";
    case "LATE":
      return "bg-status-serious/15 text-orange-800 dark:text-status-serious";
    case "LEAVE":
      return "bg-secondary/10 text-secondary";
    case "ABSENT":
      return "bg-status-critical/10 text-status-critical";
  }
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function TrainerAttendancePage() {
  const { data: batchData } = useBatches({ page: 1, limit: 100 });
  const batches = batchData?.batches ?? [];

  const [selectedBatchState, setSelectedBatch] = useState("");
  const [date, setDate] = useState(todayIso());
  // User edits made this session, layered over the server-derived defaults below —
  // avoids syncing derived state into a separate state var inside an effect.
  const [overrides, setOverrides] = useState<Record<string, AttendanceStatus>>({});

  // Derive the effective batch during render instead of setState-in-effect: falls
  // back to the first batch once the list loads, without needing to sync state.
  const selectedBatch = selectedBatchState || batches[0]?._id || "";

  const { data: students, isLoading: isLoadingStudents } = useBatchStudents(selectedBatch || null);
  const { data: existing } = useAttendance(selectedBatch, date);
  const { data: summary } = useAttendanceSummary(selectedBatch || null);
  const markMutation = useMarkAttendance();

  const summaryMap = new Map((summary ?? []).map((s) => [s.student, s.percentage]));

  const baseStatuses = useMemo(() => {
    const next: Record<string, AttendanceStatus> = {};
    for (const s of students ?? []) next[s.student._id] = "PRESENT";
    for (const record of existing ?? []) next[record.student._id] = record.status;
    return next;
  }, [students, existing]);

  function getStatus(studentId: string): AttendanceStatus {
    return overrides[studentId] ?? baseStatuses[studentId] ?? "PRESENT";
  }

  function selectBatch(id: string) {
    setSelectedBatch(id);
    setOverrides({});
  }

  function selectDate(value: string) {
    setDate(value);
    setOverrides({});
  }

  const hasChanges = Object.keys(overrides).length > 0;

  function handleSave() {
    if (!selectedBatch || !students) return;
    markMutation.mutate(
      {
        batch: selectedBatch,
        date,
        records: students.map((s) => ({
          student: s.student._id,
          status: getStatus(s.student._id),
        })),
      },
      { onSuccess: () => setOverrides({}) }
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Attendance</h2>
        <p className="text-sm text-muted-foreground">Mark and review attendance for your batches.</p>
      </div>

      <Card>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Select value={selectedBatch} onValueChange={(value) => selectBatch(value ?? "")}>
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue placeholder="Select a batch" />
              </SelectTrigger>
              <SelectContent>
                {batches.map((b) => (
                  <SelectItem key={b._id} value={b._id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DatePicker
              className="w-full sm:w-56"
              value={date}
              onChange={selectDate}
              disableFuture
              showShortcuts
            />
            <Button onClick={handleSave} disabled={!hasChanges || markMutation.isPending} className="sm:ml-auto">
              {markMutation.isPending ? "Saving..." : "Save attendance"}
            </Button>
          </div>

          {!selectedBatch ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              You have no assigned batches yet.
            </p>
          ) : isLoadingStudents ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : !students || students.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No students enrolled in this batch.
            </p>
          ) : (
            <div className="space-y-2">
              {students.map((enrollment) => {
                const status = getStatus(enrollment.student._id);
                return (
                  <div
                    key={enrollment.enrollmentId}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3"
                  >
                    <div>
                      <p className="font-medium">{enrollment.student.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {enrollment.student.email}
                        {summaryMap.has(enrollment.student._id) && (
                          <span className="ml-2">
                            · Overall: {summaryMap.get(enrollment.student._id)}%
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {STATUS_OPTIONS.map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() =>
                            setOverrides((prev) => ({ ...prev, [enrollment.student._id]: option }))
                          }
                        >
                          <Badge
                            className={
                              status === option
                                ? statusBadgeClassName(option)
                                : "bg-muted text-muted-foreground opacity-60"
                            }
                          >
                            {option}
                          </Badge>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
