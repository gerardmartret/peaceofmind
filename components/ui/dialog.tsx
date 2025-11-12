import * as React from "react"
import { cn } from "@/lib/utils"

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

function Dialog({ open, onOpenChange, children }: DialogProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      {/* Content */}
      <div className="relative z-50">
        {children}
      </div>
    </div>
  )
}

interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

function DialogContent({ children, className, ...props }: DialogContentProps) {
  return (
    <div
      className={cn(
        "bg-background border border-border rounded-lg shadow-lg p-6 max-w-md w-full mx-4",
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

function DialogHeader({ children, className, ...props }: DialogHeaderProps) {
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

function DialogTitle({ children, className, ...props }: DialogTitleProps) {
  return (
    <h2
      className={cn("text-xl font-semibold", className)}
      {...props}
    >
      {children}
    </h2>
  )
}

interface DialogDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children: React.ReactNode
}

function DialogDescription({ children, className, ...props }: DialogDescriptionProps) {
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

function DialogFooter({ children, className, ...props }: DialogFooterProps) {
  return (
    <div
      className={cn("flex justify-end gap-3 mt-6", className)}
      {...props}
    >
      {children}
    </div>
  )
}

export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter }

