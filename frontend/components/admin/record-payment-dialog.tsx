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
import { recordPaymentFormSchema, RecordPaymentFormValues } from "@/schemas/fee.schema";
import { useBatches } from "@/hooks/useBatches";
import { useBatchStudents } from "@/hooks/useBatches";
import { useFeeStatus, useRecordPayment } from "@/hooks/useFees";

interface RecordPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PAYMENT_METHODS = ["CASH", "CARD", "UPI", "BANK_TRANSFER", "OTHER"] as const;

function inr(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

export function RecordPaymentDialog({ open, onOpenChange }: RecordPaymentDialogProps) {
  const form = useForm<RecordPaymentFormValues>({
    resolver: zodResolver(recordPaymentFormSchema),
    defaultValues: {
      batch: "",
      student: "",
      amount: 0,
      // UPI screenshots go through verification; this form is mostly used at the counter.
      paymentMethod: "CASH",
      paymentDate: "",
      transactionRef: "",
      notes: "",
    },
  });

  const { data: batchData } = useBatches({ page: 1, limit: 100 });
  const batches = batchData?.batches ?? [];
  const selectedBatch = form.watch("batch");
  const { data: students } = useBatchStudents(selectedBatch || null);
  const selectedStudent = form.watch("student");
  const amount = Number(form.watch("amount"));

  // The selected student's live balance — guidance only; the backend re-checks it.
  const { data: feeData, isFetching: isFetchingFee } = useFeeStatus(
    { page: 1, limit: 100, batch: selectedBatch || undefined },
    { enabled: open && !!selectedBatch }
  );
  const feeRow = selectedStudent ? feeData?.rows.find((r) => r.student._id === selectedStudent) : undefined;
  const amountDue = feeRow?.amountDue;
  const exceedsDue = amountDue !== undefined && amount > amountDue;
  const fullyPaid = amountDue !== undefined && amountDue <= 0;

  const recordMutation = useRecordPayment();

  useEffect(() => {
    if (!open) form.reset();
  }, [open, form]);

  useEffect(() => {
    form.setValue("student", "");
  }, [selectedBatch, form]);

  function handleSubmit(values: RecordPaymentFormValues) {
    if (amountDue !== undefined && values.amount > amountDue) {
      form.setError("amount", { message: `Cannot exceed the remaining fee of ${inr(amountDue)}` });
      return;
    }
    recordMutation.mutate(
      {
        student: values.student,
        batch: values.batch,
        amount: values.amount,
        paymentMethod: values.paymentMethod,
        paymentDate: values.paymentDate || undefined,
        transactionRef: values.transactionRef || undefined,
        notes: values.notes || undefined,
      },
      { onSuccess: () => onOpenChange(false) }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            For cash and other payments made at the institute. The amount can&apos;t exceed the
            student&apos;s remaining fee, and the student is notified by email.
          </DialogDescription>
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
                          {b.name} ({b.course.name})
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
              name="student"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Student</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={!selectedBatch}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue
                          placeholder={selectedBatch ? "Select a student" : "Select a batch first"}
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(students ?? []).map((e) => (
                        <SelectItem key={e.student._id} value={e.student._id}>
                          {e.student.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedStudent && (
              <div className="rounded-xl border border-border p-3 text-sm">
                {feeRow ? (
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="font-semibold text-foreground">{inr(feeRow.finalFee)}</p>
                      <p className="text-[11px] text-muted-foreground">Total fee</p>
                    </div>
                    <div>
                      <p className="font-semibold text-status-good">{inr(feeRow.amountPaid)}</p>
                      <p className="text-[11px] text-muted-foreground">Paid</p>
                    </div>
                    <div>
                      <p className="font-semibold text-accent">{inr(feeRow.amountDue)}</p>
                      <p className="text-[11px] text-muted-foreground">Remaining</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-xs text-muted-foreground">
                    {isFetchingFee ? "Loading fee details…" : "Fee details unavailable."}
                  </p>
                )}
                {fullyPaid && (
                  <p className="mt-2 text-center text-xs font-medium text-status-good">
                    This student&apos;s fee is already fully paid.
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount (₹)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0.01} step="0.01" max={amountDue} {...field} />
                    </FormControl>
                    <FormMessage />
                    {exceedsDue && !form.formState.errors.amount && (
                      <p className="text-xs text-destructive">Cannot exceed the remaining fee of {inr(amountDue)}</p>
                    )}
                    {amountDue !== undefined && amountDue > 0 && !exceedsDue && (
                      <button
                        type="button"
                        className="text-left text-xs text-secondary hover:underline"
                        onClick={() => form.setValue("amount", amountDue, { shouldValidate: true })}
                      >
                        Fill remaining ({inr(amountDue)})
                      </button>
                    )}
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="paymentMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Method</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PAYMENT_METHODS.map((m) => (
                          <SelectItem key={m} value={m}>
                            {m.replace("_", " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="transactionRef"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Transaction reference</FormLabel>
                  <FormControl>
                    <Input placeholder="Optional" {...field} />
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
              <Button
                type="submit"
                disabled={recordMutation.isPending || exceedsDue || fullyPaid}
                className="w-full"
              >
                {recordMutation.isPending ? "Recording..." : "Record payment"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
