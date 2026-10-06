"use client"

import * as React from "react"
import { ChevronDown, Clock3 } from "lucide-react"
import { cn } from "cn"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

type Period = "AM" | "PM"
type Mode = "hour" | "minute"

interface Parts {
  hour12: number
  minute: number
  period: Period
}

function parse(value?: string): Parts | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(value ?? "")
  if (!m) return null
  const h = Number(m[1])
  return { hour12: h % 12 || 12, minute: Number(m[2]), period: h < 12 ? "AM" : "PM" }
}

function toValue({ hour12, minute, period }: Parts): string {
  const h = (hour12 % 12) + (period === "PM" ? 12 : 0)
  return `${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
}

function label(p: Parts): string {
  return `${p.hour12}:${String(p.minute).padStart(2, "0")} ${p.period}`
}

const pad = (n: number) => String(n).padStart(2, "0")

const DEFAULT_PARTS: Parts = { hour12: 9, minute: 0, period: "AM" }
const PRESETS = ["09:00", "11:00", "14:00", "16:00", "18:00", "19:00"]

// Dial geometry (px)
const DIAL = 224
const CENTER = DIAL / 2
const NUMBER_RADIUS = 86

/** Position on the dial for a 0..11 slot (slot 0 = 12 o'clock). */
function slotPosition(slot: number) {
  const angle = (slot / 12) * 2 * Math.PI - Math.PI / 2
  return { x: CENTER + NUMBER_RADIUS * Math.cos(angle), y: CENTER + NUMBER_RADIUS * Math.sin(angle) }
}

export interface TimePickerProps {
  /** Time as 24h "HH:mm" (same shape as a native time input), or "" for none. */
  value?: string
  onChange?: (value: string) => void
  onBlur?: () => void
  name?: string
  id?: string
  placeholder?: string
  disabled?: boolean
  /** Minute granularity when picking on the dial. */
  minuteStep?: number
  className?: string
  ref?: React.Ref<HTMLButtonElement>
  "aria-invalid"?: boolean
  "aria-describedby"?: string
}

function ClockDial({
  parts,
  mode,
  minuteStep,
  onPick,
  onRelease,
}: {
  parts: Parts | null
  mode: Mode
  minuteStep: number
  onPick: (patch: Partial<Parts>) => void
  onRelease: () => void
}) {
  const dialRef = React.useRef<HTMLDivElement>(null)
  const dragging = React.useRef(false)

  const fromPointer = (e: React.PointerEvent) => {
    const rect = dialRef.current!.getBoundingClientRect()
    const dx = e.clientX - (rect.left + rect.width / 2)
    const dy = e.clientY - (rect.top + rect.height / 2)
    // Degrees clockwise from 12 o'clock.
    const deg = (Math.atan2(dx, -dy) * 180) / Math.PI + 360
    if (mode === "hour") {
      onPick({ hour12: Math.round((deg % 360) / 30) % 12 || 12 })
    } else {
      const raw = Math.round((deg % 360) / 6) % 60
      onPick({ minute: (Math.round(raw / minuteStep) * minuteStep) % 60 })
    }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    const delta = e.key === "ArrowUp" || e.key === "ArrowRight" ? 1 : e.key === "ArrowDown" || e.key === "ArrowLeft" ? -1 : 0
    if (!delta) {
      if (e.key === "Enter") onRelease()
      return
    }
    e.preventDefault()
    const p = parts ?? DEFAULT_PARTS
    if (mode === "hour") onPick({ hour12: ((p.hour12 - 1 + delta + 12) % 12) + 1 })
    else onPick({ minute: (p.minute + delta * minuteStep + 60) % 60 })
  }

  const selectedSlot = parts ? (mode === "hour" ? parts.hour12 % 12 : parts.minute / 5) : null
  const handDeg = selectedSlot === null ? null : selectedSlot * 30
  const onLabel = selectedSlot !== null && Number.isInteger(selectedSlot)

  const labels =
    mode === "hour"
      ? Array.from({ length: 12 }, (_, i) => ({ slot: i, text: String(i === 0 ? 12 : i) }))
      : Array.from({ length: 12 }, (_, i) => ({ slot: i, text: pad(i * 5) }))

  return (
    <div
      ref={dialRef}
      role="slider"
      tabIndex={0}
      aria-label={mode === "hour" ? "Hour" : "Minute"}
      aria-valuemin={mode === "hour" ? 1 : 0}
      aria-valuemax={mode === "hour" ? 12 : 59}
      aria-valuenow={parts ? (mode === "hour" ? parts.hour12 : parts.minute) : undefined}
      onKeyDown={onKeyDown}
      onPointerDown={(e) => {
        dragging.current = true
        e.currentTarget.setPointerCapture(e.pointerId)
        fromPointer(e)
      }}
      onPointerMove={(e) => dragging.current && fromPointer(e)}
      onPointerUp={() => {
        if (!dragging.current) return
        dragging.current = false
        onRelease()
      }}
      className="relative mx-auto touch-none select-none rounded-full bg-gradient-to-br from-muted to-muted/40 shadow-[inset_0_2px_8px_rgba(0,0,0,0.08)] outline-none focus-visible:ring-3 focus-visible:ring-secondary/30"
      style={{ width: DIAL, height: DIAL }}
    >
      {/* Tick marks */}
      {Array.from({ length: 60 }, (_, i) => (
        <span
          key={i}
          className={cn(
            "absolute left-1/2 top-1 origin-[50%_108px] rounded-full",
            i % 5 === 0 ? "h-2 w-0.5 bg-muted-foreground/40" : "h-1 w-px bg-muted-foreground/20"
          )}
          style={{ transform: `translateX(-50%) rotate(${i * 6}deg)` }}
        />
      ))}

      {/* Hand */}
      {handDeg !== null && (
        <>
          <span
            className="absolute left-1/2 top-1/2 w-0.5 origin-bottom rounded-full bg-secondary transition-transform duration-200 ease-out"
            style={{ height: NUMBER_RADIUS, transform: `translate(-50%, -100%) rotate(${handDeg}deg)` }}
          >
            <span
              className={cn(
                "absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full bg-secondary shadow-lg shadow-secondary/40",
                onLabel ? "h-9 w-9" : "h-3 w-3 ring-4 ring-secondary/30"
              )}
            />
          </span>
          <span className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-secondary" />
        </>
      )}

      {/* Numbers */}
      {labels.map(({ slot, text }) => {
        const { x, y } = slotPosition(slot)
        const active = onLabel && selectedSlot === slot
        return (
          <span
            key={text}
            aria-hidden
            className={cn(
              "pointer-events-none absolute flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-sm tabular-nums transition-colors",
              active ? "font-bold text-white" : "font-medium text-foreground"
            )}
            style={{ left: x, top: y }}
          >
            {text}
          </span>
        )
      })}

      {/* Mode hint in the centre */}
      <span className="pointer-events-none absolute left-1/2 top-[62%] -translate-x-1/2 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/70">
        {mode === "hour" ? "Hour" : "Minute"}
      </span>
    </div>
  )
}

function TimePicker({
  value,
  onChange,
  onBlur,
  name,
  id,
  placeholder = "Pick a time",
  disabled,
  minuteStep = 5,
  className,
  ref,
  ...aria
}: TimePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [mode, setMode] = React.useState<Mode>("hour")
  const parts = parse(value)

  const update = (patch: Partial<Parts>) => {
    onChange?.(toValue({ ...(parts ?? DEFAULT_PARTS), ...patch }))
  }

  const close = () => {
    setOpen(false)
    onBlur?.()
  }

  const segment = (m: Mode, text: string) => (
    <button
      type="button"
      onClick={() => setMode(m)}
      className={cn(
        "rounded-xl px-2 py-0.5 text-4xl font-extrabold tabular-nums leading-none transition-colors",
        mode === m ? "bg-white/25 text-white" : "text-white/60 hover:bg-white/10 hover:text-white"
      )}
    >
      {text}
    </button>
  )

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setMode("hour")
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
          <Clock3 className="h-3.5 w-3.5" />
        </span>
        <span className={cn("flex-1 truncate tabular-nums", !parts && "text-muted-foreground")}>
          {parts ? label(parts) : placeholder}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-data-[popup-open]:rotate-180" />
      </PopoverTrigger>

      <PopoverContent align="start" className="w-[17.5rem] gap-0 overflow-hidden rounded-3xl border border-border/60 p-0 shadow-2xl">
        {/* Digital readout: tap hour / minute to switch what the dial edits */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#0092b5] via-[#047a97] to-[#065f74] px-4 py-4 text-white">
          <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/10" />
          <p className="relative text-[10px] font-semibold uppercase tracking-widest text-white/70">
            {mode === "hour" ? "Select hour" : "Select minute"}
          </p>
          <div className="relative mt-1.5 flex items-center justify-between">
            <div className="flex items-center">
              {segment("hour", parts ? pad(parts.hour12) : "--")}
              <span className="animate-pulse px-0.5 text-4xl font-extrabold leading-none text-white/80">:</span>
              {segment("minute", parts ? pad(parts.minute) : "--")}
            </div>
            <div className="flex flex-col gap-1">
              {(["AM", "PM"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => update({ period: p })}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-xs font-bold transition-colors",
                    parts?.period === p ? "bg-white text-[#047a97] shadow" : "bg-white/10 text-white/70 hover:bg-white/20"
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="px-4 pt-4">
          <ClockDial
            parts={parts}
            mode={mode}
            minuteStep={minuteStep}
            onPick={update}
            onRelease={() => mode === "hour" && setMode("minute")}
          />
        </div>

        <div className="mt-4 border-t border-border bg-muted/30 px-3 py-2.5">
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  onChange?.(preset)
                  close()
                }}
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors",
                  value === preset
                    ? "border-secondary bg-secondary text-white"
                    : "border-secondary/20 bg-background text-secondary hover:border-secondary hover:bg-secondary hover:text-white"
                )}
              >
                {label(parse(preset)!)}
              </button>
            ))}
          </div>
          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              onClick={() => {
                const now = new Date()
                const minute = (Math.round(now.getMinutes() / minuteStep) * minuteStep) % 60
                onChange?.(`${pad(now.getHours())}:${pad(minute)}`)
              }}
              className="flex-1 rounded-xl border border-border bg-background py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
            >
              Now
            </button>
            <button
              type="button"
              onClick={close}
              className="flex-1 rounded-xl bg-secondary py-1.5 text-xs font-semibold text-white shadow-md shadow-secondary/30 transition-colors hover:bg-secondary/90"
            >
              Done
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export { TimePicker }
