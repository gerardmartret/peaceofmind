"use client"

import * as React from "react"
import { Users } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

interface PassengerPickerProps {
  value: number
  onChange: (value: number) => void
  className?: string
  id?: string
}

// Generate passenger count options (1-20)
const generatePassengerOptions = () => {
  const options: { value: string; label: string }[] = []
  for (let count = 1; count <= 20; count++) {
    options.push({
      value: count.toString(),
      label: count === 1 ? '1 passenger' : `${count} passengers`
    })
  }
  return options
}

export function PassengerPicker({ value, onChange, className, id }: PassengerPickerProps) {
  const passengerOptions = generatePassengerOptions()

  const handleChange = (newValue: string) => {
    onChange(parseInt(newValue))
  }

  // Format the display value for the trigger
  const getDisplayValue = () => {
    if (!value || value < 1) return '1 passenger'
    return value === 1 ? '1 passenger' : `${value} passengers`
  }

  return (
    <Select value={value ? value.toString() : "1"} onValueChange={handleChange}>
      <SelectTrigger id={id} className={cn("w-full bg-white", className)}>
        <div className="flex items-center gap-2 w-full">
          <Users className="h-4 w-4" />
          <SelectValue>{getDisplayValue()}</SelectValue>
        </div>
      </SelectTrigger>
      <SelectContent className="max-h-[200px] !z-[100]" position="popper">
        {passengerOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

