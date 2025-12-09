'use client';

import * as React from "react"
import { cn } from "@/lib/utils"

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
        onPointerDown={(e) => {
          // Allow clicks on Popover and Select content to pass through
          const target = e.target as HTMLElement;
          if (target.closest('[data-slot="popover-content"]') || 
              target.closest('[data-slot="select-content"]')) {
            e.stopPropagation();
          }
        }}
      />
      {/* Content */}
      <div className="relative z-50 w-full h-full sm:w-auto sm:h-auto">
        {children}
      </div>
    </div>
  )
}

interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export function DialogContent({ children, className, ...props }: DialogContentProps) {
  return (
    <div
      className={cn(
        "bg-background border border-border rounded-md shadow-lg p-4 sm:p-6 max-w-md w-full h-full sm:h-auto sm:max-h-[90vh] sm:mx-4 overflow-y-auto",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

interface DialogHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export function DialogHeader({ children, className, ...props }: DialogHeaderProps) {
  return (
    <div
      className={cn("mb-4", className)}
      {...props}
    >
      {children}
    </div>
  )
}

interface DialogTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children: React.ReactNode
}

export function DialogTitle({ children, className, ...props }: DialogTitleProps) {
  return (
    <h2
      className={cn("text-lg sm:text-xl font-semibold", className)}
      {...props}
    >
      {children}
    </h2>
  )
}

interface DialogDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children: React.ReactNode
}

export function DialogDescription({ children, className, ...props }: DialogDescriptionProps) {
  return (
    <p
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    >
      {children}
    </p>
  )
}

interface DialogFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export function DialogFooter({ children, className, ...props }: DialogFooterProps) {
  return (
    <div
      className={cn("flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 mt-4 sm:mt-6", className)}
      {...props}
    >
      {children}
    </div>
  )
}


