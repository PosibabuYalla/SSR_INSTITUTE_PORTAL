"use client";

import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { classFormSchema, ClassFormValues } from "@/schemas/schedule.schema";
import { AdminBatch } from "@/types/batch";
import { ClassScheduleEntry, ClassScheduleFormInput } from "@/types/schedule";

interface ClassFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batches: AdminBatch[];
  classEntry?: ClassScheduleEntry | null;
  isSubmitting?: boolean;
  onSubmit: (input: ClassScheduleFormInput) => void;
}

const EMPTY: ClassFormValues = {
  batch: "",
  date: "",
  startTime: "",
  endTime: "",
  topic: "",
  description: "",
  meetingLink: "",
  location: "",
};

export function ClassFormDialog({
  open,
  onOpenChange,
  batches,
  classEntry,
  isSubmitting,
  onSubmit,
}: ClassFormDialogProps) {
  const form = useForm<ClassFormValues>({ resolver: zodResolver(classFormSchema), defaultValues: EMPTY });

  useEffect(() => {
    if (!open) return;
    form.reset(
      classEntry
        ? {
            batch: classEntry.batch._id,
            date: classEntry.date.slice(0, 10),
            startTime: classEntry.startTime,
            endTime: classEntry.endTime,
            topic: classEntry.topic,
            description: classEntry.description ?? "",
            meetingLink: classEntry.meetingLink ?? "",
            location: classEntry.location ?? "",
          }
        : EMPTY
    );
  }, [open, classEntry, form]);

  function handleSubmit(values: ClassFormValues) {
    onSubmit({
      batch: values.batch,
      date: values.date,
      startTime: values.startTime,
      endTime: values.endTime,
      topic: values.topic,
      description: values.description || undefined,
      meetingLink: values.meetingLink || undefined,
      location: values.location || undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{classEntry ? "Edit class" : "Schedule a class"}</DialogTitle>
          <DialogDescription>Students in the batch will see this on their schedule.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="batch"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Batch</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a batch" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {batches.map((b) => (
                        <SelectItem key={b._id} value={b._id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="topic"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Topic</FormLabel>
                  <FormControl>
                    <Input placeholder="Intro to React Hooks" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
                name="startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start</FormLabel>
                    <FormControl>
                      <TimePicker {...field} placeholder="Start time" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End</FormLabel>
                    <FormControl>
                      <TimePicker {...field} placeholder="End time" />
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
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl>
                    <Input placeholder="Optional" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea rows={3} placeholder="Optional" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? "Saving..." : classEntry ? "Save changes" : "Schedule class"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
