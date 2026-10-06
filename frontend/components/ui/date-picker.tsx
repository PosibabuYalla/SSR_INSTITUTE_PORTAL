"use client"

import * as React from "react"
import { addDays, format, isSameMonth, isValid, nextMonday, parse, startOfToday } from "date-fns"
import { CalendarCheck2, CalendarDays, CalendarPlus, CalendarRange, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "cn"

import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

const VALUE_FORMAT = "yyyy-MM-dd"

function toDate(value?: string): Date | undefined {
  if (!value) return undefined
  const d = parse(value, VALUE_FORMAT, new Date())
  return isValid(d) ? d : undefined
}

export interface DatePickerProps {
  /** Date as "yyyy-MM-dd" (same shape as a native date input), or "" for none. */
  value?: string
  onChange?: (value: string) => void
  onBlur?: () => void
  name?: string
  id?: string
  placeholder?: string
  disabled?: boolean
  /** Earliest / latest selectable day, as "yyyy-MM-dd". */
  min?: string
  max?: string
  /** Show "Today" / "Tomorrow" shortcuts (handy for scheduling, not for birthdays). */
  showShortcuts?: boolean
  /** Month + year dropdowns, for picking far-off dates like a date of birth. */
  yearNavigation?: boolean
  clearable?: boolean
  /** Block days after today (date of birth, attendance). */
  disableFuture?: boolean
  className?: string
  ref?: React.Ref<HTMLButtonElement>
  "aria-invalid"?: boolean
  "aria-describedby"?: string
}

function DatePicker({
  value,
  onChange,
  onBlur,
  name,
  id,
  placeholder = "Pick a date",
  disabled,
  min,
  max,
  showShortcuts = false,
  yearNavigation = false,
  clearable = false,
  disableFuture = false,
  className,
  ref,
  ...aria
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const selected = toDate(value)
  const minDate = toDate(min)
  const maxDate = toDate(max) ?? (disableFuture ? startOfToday() : undefined)
  const today = startOfToday()
  const [month, setMonth] = React.useState<Date>(selected ?? today)

  const pick = (d: Date | undefined) => {
    onChange?.(d ? format(d, VALUE_FORMAT) : "")
    setOpen(false)
    onBlur?.()
  }

  const isAllowed = (d: Date) =>
    (!minDate || format(d, VALUE_FORMAT) >= format(minDate, VALUE_FORMAT)) &&
    (!maxDate || format(d, VALUE_FORMAT) <= format(maxDate, VALUE_FORMAT))

  const shortcuts = [
    { label: "Today", date: today, icon: CalendarCheck2 },
    { label: "Tomorrow", date: addDays(today, 1), icon: CalendarPlus },
    { label: "Next Mon", date: nextMonday(today), icon: CalendarRange },
  ].filter((s) => isAllowed(s.date))

  const shown = selected ?? today

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setMonth(selected ?? today)
        else onBlur?.()
      }}
    >
      <PopoverTrigger
        ref={ref}
        id={id}
        name={name}
        disabled={disabled}
        aria-invalid={aria["aria-invalid"]}
        aria-describedby={aria["aria-describedby"]}
        className={cn(
          "group flex h-9 w-full min-w-0 items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 text-left text-sm transition-colors outline-none",
          "hover:border-secondary/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "data-[popup-open]:border-secondary data-[popup-open]:ring-3 data-[popup-open]:ring-secondary/20",
          "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30",
          className
        )}
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-secondary/10 text-secondary">
          <CalendarDays className="h-3.5 w-3.5" />
        </span>
        <span className={cn("flex-1 truncate", !selected && "text-muted-foreground")}>
          {selected ? format(selected, "EEE, d MMM yyyy") : placeholder}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-data-[popup-open]:rotate-180" />
      </PopoverTrigger>

      <PopoverContent align="start" className="w-[19rem] gap-0 overflow-hidden rounded-3xl border border-border/60 p-0 shadow-2xl">
        {/* Header: big tear-off style day card + full date */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#0092b5] via-[#047a97] to-[#065f74] px-4 py-4 text-white">
          <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-12 right-10 h-24 w-24 rounded-full bg-white/5" />
          <div className="relative flex items-center gap-3.5">
            <div className="w-14 shrink-0 overflow-hidden rounded-xl bg-white text-center shadow-lg">
              <p className="bg-rose-500 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white">
                {format(shown, "MMM")}
              </p>
              <p className="py-1 text-2xl font-extrabold leading-none text-slate-800">{format(shown, "dd")}</p>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/70">
                {selected ? "Selected date" : "Select a date"}
              </p>
              <p className="truncate text-lg font-bold leading-tight">{format(shown, "EEEE")}</p>
              <p className="text-xs text-white/80">{format(shown, "MMMM yyyy")}</p>
            </div>
          </div>
        </div>

        <div className="px-3 pt-3">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={pick}
            month={month}
            onMonthChange={setMonth}
            captionLayout={yearNavigation ? "dropdown" : "label"}
            startMonth={minDate ?? (yearNavigation ? new Date(1950, 0) : undefined)}
            endMonth={maxDate ?? (yearNavigation ? new Date(today.getFullYear() + 5, 11) : undefined)}
            disabled={[
              ...(minDate ? [{ before: minDate }] : []),
              ...(maxDate ? [{ after: maxDate }] : []),
            ]}
            modifiers={{ weekend: { dayOfWeek: [0, 6] } }}
            className="w-full bg-transparent p-0 [--cell-size:--spacing(9)]"
            classNames={{
              root: "w-full",
              month: "flex w-full flex-col gap-3",
              month_caption: "flex h-8 w-full items-center px-1",
              caption_label: cn(
                "text-sm font-bold text-foreground",
                yearNavigation && "flex items-center gap-1 rounded-lg px-1.5 py-0.5 hover:bg-muted [&>svg]:size-3.5 [&>svg]:text-muted-foreground"
              ),
              nav: "absolute right-0 top-0 flex items-center gap-1",
              button_previous:
                "flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-secondary hover:bg-secondary hover:text-white aria-disabled:pointer-events-none aria-disabled:opacity-30",
              button_next:
                "flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-secondary hover:bg-secondary hover:text-white aria-disabled:pointer-events-none aria-disabled:opacity-30",
              weekdays: "flex rounded-xl bg-muted/60 py-1.5",
              weekday:
                "flex-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground first:text-rose-500 last:text-rose-500",
              week: "mt-1 flex w-full",
              day: "relative flex-1 p-0.5 text-center",
              today: "",
            }}
            formatters={{ formatWeekdayName: (d) => format(d, "EEEEE") }}
            components={{
              Chevron: ({ orientation }) =>
                orientation === "left" ? (
                  <ChevronLeft className="h-4 w-4" />
                ) : orientation === "right" ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                ),
              DayButton: ({ day, modifiers, className: dayClass, ...props }) => (
                <button
                  {...props}
                  type="button"
                  className={cn(
                    "relative mx-auto flex aspect-square w-full max-w-9 flex-col items-center justify-center rounded-xl text-sm tabular-nums transition-all duration-150",
                    "hover:scale-105 hover:bg-secondary/10 hover:text-secondary focus-visible:ring-2 focus-visible:ring-secondary/40 focus-visible:outline-none",
                    modifiers.weekend && !modifiers.selected && "text-rose-500",
                    modifiers.today && !modifiers.selected && "bg-secondary/10 font-bold text-secondary",
                    modifiers.selected &&
                      "scale-105 bg-gradient-to-br from-[#0092b5] to-[#065f74] font-bold text-white shadow-lg shadow-secondary/40 hover:bg-transparent hover:text-white",
                    modifiers.outside && !modifiers.selected && "opacity-35",
                    modifiers.disabled && "pointer-events-none line-through opacity-25",
                    dayClass
                  )}
                >
                  {day.date.getDate()}
                  {modifiers.today && (
                    <span
                      className={cn(
                        "absolute bottom-1 h-1 w-1 rounded-full",
                        modifiers.selected ? "bg-white" : "bg-secondary"
                      )}
                    />
                  )}
                </button>
              ),
            }}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border bg-muted/30 px-3 py-2.5">
          {showShortcuts ? (
            shortcuts.map(({ label, date, icon: Icon }) => (
              <button
                key={label}
                type="button"
                onClick={() => pick(date)}
                className="inline-flex items-center gap-1 rounded-full border border-secondary/20 bg-background px-2.5 py-1 text-[11px] font-medium text-secondary transition-colors hover:border-secondary hover:bg-secondary hover:text-white"
              >
                <Icon className="h-3 w-3" />
                {label}
              </button>
            ))
          ) : (
            !isSameMonth(month, today) && (
              <button
                type="button"
                onClick={() => setMonth(today)}
                className="inline-flex items-center gap-1 rounded-full border border-secondary/20 bg-background px-2.5 py-1 text-[11px] font-medium text-secondary transition-colors hover:border-secondary hover:bg-secondary hover:text-white"
              >
                <CalendarCheck2 className="h-3 w-3" />
                This month
              </button>
            )
          )}
          {clearable && selected && (
            <button
              type="button"
              onClick={() => pick(undefined)}
              className="rounded-full px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Clear
            </button>
          )}
          <span className="ml-auto flex items-center gap-2.5 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-secondary" /> Today
            </span>
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> Weekend
            </span>
          </span>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export { DatePicker }
