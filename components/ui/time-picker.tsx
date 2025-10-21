"use client"

import * as React from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

interface TimePickerProps {
  value: string
  onChange: (value: string) => void
  className?: string
  id?: string
}

// Generate hours (00-23)
const generateHours = () => {
  const hours: string[] = []
  for (let hour = 0; hour < 24; hour++) {
    hours.push(hour.toString().padStart(2, '0'))
  }
  return hours
}

// Generate minutes with 5-minute intervals (00, 05, 10, ..., 55)
const generateMinutes = () => {
  const minutes: string[] = []
  for (let minute = 0; minute < 60; minute += 5) {
    minutes.push(minute.toString().padStart(2, '0'))
  }
  return minutes
}

export function TimePicker({ value, onChange, className, id }: TimePickerProps) {
  const hours = generateHours()
  const minutes = generateMinutes()

  // Parse the current value
  const [hour, minute] = value ? value.split(':').slice(0, 2) : ['09', '00']

  const handleHourChange = (newHour: string) => {
    onChange(`${newHour}:${minute}`)
  }

  const handleMinuteChange = (newMinute: string) => {
    onChange(`${hour}:${newMinute}`)
  }

  return (
    <div className={cn("flex gap-2", className)}>
      {/* Hour Selector */}
      <Select value={hour} onValueChange={handleHourChange}>
        <SelectTrigger 
          id={id}
          className="w-full bg-card"
        >
          <SelectValue placeholder="HH" />
        </SelectTrigger>
        <SelectContent className="max-h-[200px]">
          {hours.map((h) => (
            <SelectItem key={h} value={h}>
              {h}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <span className="flex items-center text-muted-foreground font-medium">:</span>

      {/* Minute Selector */}
      <Select value={minute} onValueChange={handleMinuteChange}>
        <SelectTrigger className="w-full bg-card">
          <SelectValue placeholder="MM" />
        </SelectTrigger>
        <SelectContent className="max-h-[200px]">
          {minutes.map((m) => (
            <SelectItem key={m} value={m}>
              {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

