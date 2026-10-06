"use client";

import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
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
import { Card, CardContent } from "@/components/ui/card";
import { linesToArray, taskFormSchema, TaskFormValues } from "@/schemas/task.schema";
import { AdminBatch } from "@/types/batch";
import { TaskFormInput } from "@/types/task";

interface TaskFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batches: AdminBatch[];
  isSubmitting?: boolean;
  onSubmit: (input: TaskFormInput) => void;
}

const EMPTY: TaskFormValues = {
  type: "ASSIGNMENT",
  title: "",
  description: "",
  batch: "",
  dueDate: "",
  maxMarks: 100,
  attachmentUrlsText: "",
  questions: [],
  requirementsText: "",
  submissionFormat: "",
};

export function TaskFormSheet({ open, onOpenChange, batches, isSubmitting, onSubmit }: TaskFormSheetProps) {
  const form = useForm<TaskFormValues>({ resolver: zodResolver(taskFormSchema), defaultValues: EMPTY });
  const type = form.watch("type");

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "questions" });

  useEffect(() => {
    if (!open) form.reset(EMPTY);
  }, [open, form]);

  function handleSubmit(values: TaskFormValues) {
    if (values.type === "ASSIGNMENT") {
      onSubmit({
        type: "ASSIGNMENT",
        title: values.title,
        description: values.description,
        batch: values.batch,
        dueDate: values.dueDate,
        maxMarks: values.maxMarks,
        attachmentUrls: linesToArray(values.attachmentUrlsText),
      });
    } else if (values.type === "QUIZ") {
      onSubmit({
        type: "QUIZ",
        title: values.title,
        description: values.description,
        batch: values.batch,
        dueDate: values.dueDate,
        maxMarks: values.maxMarks,
        timeLimitMinutes: values.timeLimitMinutes,
        attemptsAllowed: values.attemptsAllowed,
        questions: (values.questions ?? []).map((q) => ({
          question: q.question,
          marks: q.marks,
          options: [
            { text: q.optionA, isCorrect: q.correctIndex === 0 },
            { text: q.optionB, isCorrect: q.correctIndex === 1 },
            { text: q.optionC, isCorrect: q.correctIndex === 2 },
            { text: q.optionD, isCorrect: q.correctIndex === 3 },
          ],
        })),
      });
    } else {
      onSubmit({
        type: "PROJECT",
        title: values.title,
        description: values.description,
        batch: values.batch,
        dueDate: values.dueDate,
        maxMarks: values.maxMarks,
        requirements: linesToArray(values.requirementsText),
        submissionFormat: values.submissionFormat || undefined,
      });
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Create task</SheetTitle>
          <SheetDescription>New tasks start as a draft. Publish once ready.</SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 px-4 pb-4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Task type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="ASSIGNMENT">Assignment</SelectItem>
                      <SelectItem value="QUIZ">Quiz</SelectItem>
                      <SelectItem value="PROJECT">Project</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

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
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input {...field} />
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
                    <Textarea rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due date</FormLabel>
                    <FormControl>
                      <DatePicker {...field} showShortcuts placeholder="Select due date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="maxMarks"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max marks</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {type === "ASSIGNMENT" && (
              <FormField
                control={form.control}
                name="attachmentUrlsText"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Attachment URLs</FormLabel>
                    <FormControl>
                      <Textarea rows={2} placeholder="One per line" {...field} />
                    </FormControl>
                    <FormDescription>Optional reference files, one URL per line.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {type === "PROJECT" && (
              <>
                <FormField
                  control={form.control}
                  name="requirementsText"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Requirements</FormLabel>
                      <FormControl>
                        <Textarea rows={3} placeholder="One per line" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="submissionFormat"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Submission format</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. GitHub repo link" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {type === "QUIZ" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="timeLimitMinutes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Time limit (min)</FormLabel>
                        <FormControl>
                          <Input type="number" min={1} {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="attemptsAllowed"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Attempts allowed</FormLabel>
                        <FormControl>
                          <Input type="number" min={1} {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormLabel>Questions</FormLabel>
                {fields.map((qField, index) => (
                  <Card key={qField.id}>
                    <CardContent className="space-y-2">
                      <div className="flex items-start gap-2">
                        <FormField
                          control={form.control}
                          name={`questions.${index}.question`}
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormControl>
                                <Input placeholder={`Question ${index + 1}`} {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => remove(index)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {(["optionA", "optionB", "optionC", "optionD"] as const).map((optKey, optIndex) => (
                          <FormField
                            key={optKey}
                            control={form.control}
                            name={`questions.${index}.${optKey}`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input placeholder={`Option ${optIndex + 1}`} {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name={`questions.${index}.correctIndex`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Correct option</FormLabel>
                              <Select onValueChange={field.onChange} value={String(field.value)}>
                                <FormControl>
                                  <SelectTrigger className="w-full">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="0">Option 1</SelectItem>
                                  <SelectItem value="1">Option 2</SelectItem>
                                  <SelectItem value="2">Option 3</SelectItem>
                                  <SelectItem value="3">Option 4</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`questions.${index}.marks`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Marks</FormLabel>
                              <FormControl>
                                <Input type="number" min={0} {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    append({
                      question: "",
                      optionA: "",
                      optionB: "",
                      optionC: "",
                      optionD: "",
                      correctIndex: 0,
                      marks: 1,
                    })
                  }
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add question
                </Button>
              </div>
            )}

            <SheetFooter className="px-0">
              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? "Creating..." : "Create task"}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
