"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { scheduleInterviewFormSchema, ScheduleInterviewFormValues } from "@/schemas/interview.schema";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useActiveStudents } from "@/hooks/useUsers";
import { useBatches } from "@/hooks/useBatches";
import { useScheduleInterview } from "@/hooks/useInterviews";

interface ScheduleInterviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const INTERVIEW_TYPES = ["TECHNICAL", "HR", "COMMUNICATION", "PROJECT_REVIEW", "APTITUDE"] as const;

export function ScheduleInterviewDialog({ open, onOpenChange }: ScheduleInterviewDialogProps) {
  const form = useForm<ScheduleInterviewFormValues>({
    resolver: zodResolver(scheduleInterviewFormSchema),
    defaultValues: {
      student: "",
      batch: "",
      date: "",
      time: "",
      meetingLink: "",
      type: "TECHNICAL",
      topicsText: "",
      notes: "",
    },
  });

  const [studentSearch, setStudentSearch] = useState("");
  const debouncedSearch = useDebouncedValue(studentSearch);
  const { data: studentData } = useActiveStudents(debouncedSearch || undefined);
  const { data: batchData } = useBatches({ page: 1, limit: 100 });
  const scheduleMutation = useScheduleInterview();

  useEffect(() => {
    if (!open) form.reset();
  }, [open, form]);

  function handleSubmit(values: ScheduleInterviewFormValues) {
    scheduleMutation.mutate(
      {
        student: values.student,
        batch: values.batch || undefined,
        date: values.date,
        time: values.time,
        meetingLink: values.meetingLink || undefined,
        type: values.type,
        topics: values.topicsText
          ? values.topicsText.split(",").map((t) => t.trim()).filter(Boolean)
          : undefined,
        notes: values.notes || undefined,
      },
      { onSuccess: () => onOpenChange(false) }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule mock interview</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="student"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Student</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Search and select a student" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <div className="p-1">
                        <Input
                          placeholder="Search students..."
                          value={studentSearch}
                          onChange={(e) => setStudentSearch(e.target.value)}
                          onKeyDown={(e) => e.stopPropagation()}
                        />
                      </div>
                      {(studentData?.users ?? []).map((s) => (
                        <SelectItem key={s._id} value={s._id}>
                          {s.name} ({s.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="batch"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Batch (optional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(batchData?.batches ?? []).map((b) => (
                          <SelectItem key={b._id} value={b._id}>
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {INTERVIEW_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t.replace("_", " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <DatePicker {...field} showShortcuts placeholder="Select date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Time</FormLabel>
                    <FormControl>
                      <TimePicker {...field} placeholder="Select time" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="meetingLink"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Meeting link</FormLabel>
                  <FormControl>
                    <Input placeholder="Optional" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="topicsText"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Topics</FormLabel>
                  <FormControl>
                    <Input placeholder="React, System Design" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea rows={2} placeholder="Optional" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={scheduleMutation.isPending} className="w-full">
                {scheduleMutation.isPending ? "Scheduling..." : "Schedule interview"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
