"use client"

import * as React from "react"
import { Clock } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface TimePickerProps {
  value: string
  onChange: (value: string) => void
  className?: string
  id?: string
}

// Generate hours (00-23)
const generateHours = () => {
  const hours: { value: string; label: string }[] = []
  for (let hour = 0; hour < 24; hour++) {
    const hourStr = hour.toString().padStart(2, '0')
    hours.push({
      value: hourStr,
      label: hourStr
    })
  }
  return hours
}

// Generate minutes with 5-minute intervals (00, 05, 10, ..., 55)
const generateMinutes = () => {
  const minutes: { value: string; label: string }[] = []
  for (let minute = 0; minute < 60; minute += 5) {
    const minuteStr = minute.toString().padStart(2, '0')
    minutes.push({
      value: minuteStr,
      label: minuteStr
    })
  }
  return minutes
}

export function TimePicker({ value, onChange, className, id }: TimePickerProps) {
  const [open, setOpen] = React.useState(false)
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

  // Format the display value for the trigger
  const getDisplayValue = () => {
    if (!value) return ''
    const [h, m] = value.split(':')
    return `${h}:${m}H`
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          id={id}
          className={cn("w-full justify-start text-left font-normal bg-card", className)}
        >
          <Clock className="mr-2 h-4 w-4" />
          {value ? getDisplayValue() : <span>Select time</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-4" align="start">
        <div className="flex flex-col gap-4">
          <div className="flex gap-3">
            {/* Hour Selector */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted-foreground">Hour</label>
              <Select value={hour} onValueChange={handleHourChange}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {hours.map((h) => (
                    <SelectItem key={h.value} value={h.value}>
                      {h.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Minute Selector */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted-foreground">Minute</label>
              <Select value={minute} onValueChange={handleMinuteChange}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {minutes.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Confirm Button */}
          <Button 
            onClick={() => setOpen(false)}
            className="w-full"
            size="sm"
          >
            Confirm
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

