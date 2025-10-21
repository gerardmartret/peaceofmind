"use client"

import * as React from "react"
import { Clock } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

interface TimePickerProps {
  value: string
  onChange: (value: string) => void
  className?: string
  id?: string
}

// Generate time slots with 5-minute intervals in a user-friendly format
const generateTimeSlots = () => {
  const slots: { value: string; label: string }[] = []
  
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 5) {
      const hourStr = hour.toString().padStart(2, '0')
      const minuteStr = minute.toString().padStart(2, '0')
      const timeValue = `${hourStr}:${minuteStr}`
      
      // Format for display (12-hour format with AM/PM)
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
      const ampm = hour < 12 ? 'AM' : 'PM'
      const displayMinute = minuteStr
      
      slots.push({
        value: timeValue,
        label: `${displayHour}:${displayMinute} ${ampm}`
      })
    }
  }
  
  return slots
}

export function TimePicker({ value, onChange, className, id }: TimePickerProps) {
  const timeSlots = generateTimeSlots()

  // Ensure the value is in HH:MM format (remove seconds if present)
  const normalizedValue = value ? value.split(':').slice(0, 2).join(':') : ''

  // Format the display value for the trigger
  const getDisplayValue = () => {
    if (!normalizedValue) return ''
    const [hour, minute] = normalizedValue.split(':')
    const hourNum = parseInt(hour)
    const displayHour = hourNum === 0 ? 12 : hourNum > 12 ? hourNum - 12 : hourNum
    const ampm = hourNum < 12 ? 'AM' : 'PM'
    return `${displayHour}:${minute} ${ampm}`
  }

  return (
    <Select value={normalizedValue} onValueChange={onChange}>
      <SelectTrigger 
        id={id}
        className={cn("w-full bg-card", className)}
      >
        <Clock className="mr-2 h-4 w-4" />
        <SelectValue placeholder="Select time">
          {getDisplayValue()}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-[300px]">
        {timeSlots.map((slot) => (
          <SelectItem key={slot.value} value={slot.value}>
            {slot.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

