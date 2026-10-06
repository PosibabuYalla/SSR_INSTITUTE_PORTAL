"use client";

import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { batchFormSchema, BatchFormValues, CLASS_DAY_OPTIONS } from "@/schemas/batch.schema";
import { usePublicCourses } from "@/hooks/useCourses";
import { useActiveTrainers } from "@/hooks/useUsers";
import { AdminBatch, BatchFormInput } from "@/types/batch";

interface BatchFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batch?: AdminBatch | null;
  isSubmitting?: boolean;
  onSubmit: (input: BatchFormInput) => void;
}

const EMPTY_VALUES: BatchFormValues = {
  name: "",
  course: "",
  trainer: "",
  startDate: "",
  endDate: "",
  classDays: [],
  startTime: "",
  endTime: "",
  mode: "ONLINE",
  location: "",
  capacity: 30,
};

function toDateInputValue(iso?: string): string {
  return iso ? iso.slice(0, 10) : "";
}

export function BatchFormSheet({ open, onOpenChange, batch, isSubmitting, onSubmit }: BatchFormSheetProps) {
  const { data: courses } = usePublicCourses();
  const { data: trainerData } = useActiveTrainers();
  const trainers = trainerData?.users ?? [];

  const form = useForm<BatchFormValues>({
    resolver: zodResolver(batchFormSchema),
    defaultValues: EMPTY_VALUES,
  });

  useEffect(() => {
    if (!open) return;
    if (batch) {
      form.reset({
        name: batch.name,
        course: batch.course?._id ?? "",
        trainer: batch.trainer?._id ?? "",
        startDate: toDateInputValue(batch.startDate),
        endDate: toDateInputValue(batch.endDate),
        classDays: batch.classDays,
        startTime: batch.startTime,
        endTime: batch.endTime,
        mode: batch.mode,
        location: batch.location ?? "",
        capacity: batch.capacity,
      });
    } else {
      form.reset(EMPTY_VALUES);
    }
  }, [open, batch, form]);

  function handleSubmit(values: BatchFormValues) {
    onSubmit({
      ...values,
      trainer: values.trainer || undefined,
      location: values.location || undefined,
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{batch ? "Edit batch" : "Create batch"}</SheetTitle>
          <SheetDescription>
            {batch ? "Update the batch schedule and settings." : "Schedule a new batch for a course."}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 px-4 pb-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Batch name</FormLabel>
                  <FormControl>
                    <Input placeholder="MERN Batch A" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="course"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Course</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a course" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {courses?.map((c) => (
                        <SelectItem key={c._id} value={c._id}>
                          {c.name}
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
              name="trainer"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Trainer</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ""}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Unassigned" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {trainers.map((t) => (
                        <SelectItem key={t._id} value={t._id}>
                          {t.name}
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
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start date</FormLabel>
                    <FormControl>
                      <DatePicker {...field} placeholder="Start date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End date</FormLabel>
                    <FormControl>
                      <DatePicker {...field} placeholder="End date" />
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
                    <FormLabel>Start time</FormLabel>
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
                    <FormLabel>End time</FormLabel>
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
              name="classDays"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Class days</FormLabel>
                  <div className="flex flex-wrap gap-3">
                    {CLASS_DAY_OPTIONS.map((day) => {
                      const checked = field.value.includes(day);
                      return (
                        <label key={day} className="flex items-center gap-1.5 text-sm">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(value) => {
                              if (value) field.onChange([...field.value, day]);
                              else field.onChange(field.value.filter((d) => d !== day));
                            }}
                          />
                          {day}
                        </label>
                      );
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="mode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mode</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="ONLINE">Online</SelectItem>
                        <SelectItem value="OFFLINE">Offline</SelectItem>
                        <SelectItem value="HYBRID">Hybrid</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="capacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Capacity</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl>
                    <Input placeholder="Optional — room, address, or meeting link" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <SheetFooter className="px-0">
              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? "Saving..." : batch ? "Save changes" : "Create batch"}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
