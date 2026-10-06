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
  FormDescription,
  FormMessage,
} from "@/components/ui/form";
import { jobFormSchema, JobFormValues } from "@/schemas/job.schema";
import { AdminJob, JobFormInput } from "@/types/job";

interface JobFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job?: AdminJob | null;
  isSubmitting?: boolean;
  onSubmit: (input: JobFormInput) => void;
}

const EMPTY_VALUES: JobFormValues = {
  company: "",
  title: "",
  description: "",
  location: "",
  workMode: "REMOTE",
  salaryRange: "",
  skillsText: "",
  minExperienceYears: 0,
  educationRequirement: "",
  applicationDeadline: "",
  openings: 1,
  jobLink: "",
};

export function JobFormSheet({ open, onOpenChange, job, isSubmitting, onSubmit }: JobFormSheetProps) {
  const form = useForm<JobFormValues>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: EMPTY_VALUES,
  });

  useEffect(() => {
    if (!open) return;
    if (job) {
      form.reset({
        company: job.company,
        title: job.title,
        description: job.description,
        location: job.location ?? "",
        workMode: job.workMode,
        salaryRange: job.salaryRange ?? "",
        skillsText: job.skills.join(", "),
        minExperienceYears: job.minExperienceYears,
        educationRequirement: job.educationRequirement ?? "",
        applicationDeadline: job.applicationDeadline.slice(0, 10),
        openings: job.openings,
        jobLink: job.jobLink ?? "",
      });
    } else {
      form.reset(EMPTY_VALUES);
    }
  }, [open, job, form]);

  function handleSubmit(values: JobFormValues) {
    onSubmit({
      company: values.company,
      title: values.title,
      description: values.description,
      location: values.location || undefined,
      workMode: values.workMode,
      salaryRange: values.salaryRange || undefined,
      skills: values.skillsText
        ? values.skillsText.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined,
      minExperienceYears: values.minExperienceYears,
      educationRequirement: values.educationRequirement || undefined,
      applicationDeadline: values.applicationDeadline,
      openings: values.openings,
      jobLink: values.jobLink || undefined,
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{job ? "Edit job" : "Post a job"}</SheetTitle>
          <SheetDescription>
            {job ? "Update the job posting." : "New jobs start as a draft. Publish once ready."}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 px-4 pb-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="company"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company</FormLabel>
                    <FormControl>
                      <Input placeholder="Acme Corp" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Job title</FormLabel>
                    <FormControl>
                      <Input placeholder="Junior Developer" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea rows={4} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="workMode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Work mode</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="ONSITE">Onsite</SelectItem>
                        <SelectItem value="REMOTE">Remote</SelectItem>
                        <SelectItem value="HYBRID">Hybrid</SelectItem>
                      </SelectContent>
                    </Select>
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
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="salaryRange"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Salary range</FormLabel>
                    <FormControl>
                      <Input placeholder="₹4-6 LPA" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="minExperienceYears"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Min. experience (years)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="skillsText"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Required skills</FormLabel>
                  <FormControl>
                    <Input placeholder="React, Node.js, MongoDB" {...field} />
                  </FormControl>
                  <FormDescription>Separate skills with commas.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="applicationDeadline"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Application deadline</FormLabel>
                    <FormControl>
                      <DatePicker {...field} showShortcuts placeholder="Select deadline" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="openings"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Openings</FormLabel>
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
              name="educationRequirement"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Education requirement</FormLabel>
                  <FormControl>
                    <Input placeholder="Optional" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="jobLink"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>External job link</FormLabel>
                  <FormControl>
                    <Input placeholder="https://..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <SheetFooter className="px-0">
              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? "Saving..." : job ? "Save changes" : "Create job"}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
