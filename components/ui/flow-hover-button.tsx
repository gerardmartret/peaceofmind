import * as React from 'react'
import { cn } from '@/lib/utils'

interface FlowHoverButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode
  children?: React.ReactNode
  variant?: 'confirmed' | 'pending' | 'not-confirmed' | 'cancelled' | 'rejected'
}

export const FlowHoverButton: React.FC<FlowHoverButtonProps> = ({ 
  icon, 
  children, 
  variant = 'not-confirmed',
  className,
  ...props 
}) => {
  // Determine colors based on variant
  const colors = variant === 'confirmed' 
    ? {
        bg: 'bg-[#3ea34b]',
        border: 'border-[#3ea34b]',
        text: 'text-white',
        hoverBg: 'before:bg-[#2d7a35]', // Darker green for hover
        hoverText: 'hover:text-white'
      }
    : variant === 'pending'
    ? {
        bg: 'bg-[#e77500]',
        border: 'border-[#e77500]',
        text: 'text-white',
        hoverBg: 'before:bg-[#b85d00]', // Darker orange for hover
        hoverText: 'hover:text-white'
      }
    : variant === 'cancelled'
    ? {
        bg: 'bg-[#9e201b]',
        border: 'border-[#9e201b]',
        text: 'text-white',
        hoverBg: 'before:bg-[#7a1815]', // Darker red for hover
        hoverText: 'hover:text-white'
      }
    : variant === 'rejected'
    ? {
        bg: 'bg-[#c41e3a]',
        border: 'border-[#c41e3a]',
        text: 'text-white',
        hoverBg: 'before:bg-[#9e1830]', // Darker red for hover
        hoverText: 'hover:text-white'
      }
    : {
        bg: 'bg-[#9e201b]',
        border: 'border-[#9e201b]',
        text: 'text-white',
        hoverBg: 'before:bg-[#7a1815]', // Darker red for hover
        hoverText: 'hover:text-white'
      };

  return (
    <button
      className={cn(
        `relative cursor-pointer z-0 flex items-center justify-center gap-2 overflow-hidden rounded-lg 
        border ${colors.border} ${colors.bg} 
        px-6 py-3.5 text-xl font-medium ${colors.text} transition-all duration-500
        before:absolute before:inset-0 before:-z-10 before:translate-x-[150%] before:translate-y-[150%] before:scale-[2.5]
        before:rounded-[100%] ${colors.hoverBg} before:transition-transform before:duration-1000 before:content-[""]
        hover:scale-105 ${colors.hoverText} hover:before:translate-x-[0%] hover:before:translate-y-[0%] active:scale-95`,
        className
      )}
      {...props}
    >
      {icon}
      <span>{children}</span>
    </button>
  )
}

