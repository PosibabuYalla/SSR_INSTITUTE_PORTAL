"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-[18px]" strokeWidth={2.25} />
        ),
        info: (
          <InfoIcon className="size-[18px]" strokeWidth={2.25} />
        ),
        warning: (
          <TriangleAlertIcon className="size-[18px]" strokeWidth={2.25} />
        ),
        error: (
          <OctagonXIcon className="size-[18px]" strokeWidth={2.25} />
        ),
        loading: (
          <Loader2Icon className="size-[18px] animate-spin" strokeWidth={2.25} />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          // Card-style toasts with a type-coloured accent stripe — styles live in globals.css.
          toast: "ssr-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
