/**
 * EditRouteModal Component
 * 
 * Modal for editing trip route manually, including locations, dates, passenger info, and notes.
 * Includes drag-and-drop location reordering functionality.
 */

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { PassengerPicker } from '@/components/ui/passenger-picker';
import { TimePicker } from '@/components/ui/time-picker';
import GoogleLocationSearch from '@/components/GoogleLocationSearch';
import { Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { formatTimeForPicker } from '../utils/time-helpers';
import { formatLocationDisplay } from '@/lib/helpers/location-formatters';
import { numberToLetter } from '@/lib/helpers/string-helpers';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { SortableEditLocationItemProps } from '../types';

// Sub-component: SortableEditLocationItem
function SortableEditLocationItem({
  location,
  index,
  totalLocations,
  onLocationSelect,
  onTimeChange,
  onRemove,
  canRemove,
  editingIndex,
  editingField,
  onEditStart,
  onEditEnd,
  tripDestination,
}: SortableEditLocationItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: location.placeId || `fallback-${index}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getTimeLabel = () => {
    if (index === 0) return 'Pickup time';
    if (index === totalLocations - 1) return 'Dropoff time';
    return 'Resume at';
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-card rounded-md p-4 border border-border relative"
    >
      <div className="absolute top-2 left-2 text-muted-foreground/40 text-xs font-normal">
        {numberToLetter(index + 1)}
      </div>

        <div className="flex items-start gap-2 sm:gap-3">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted dark:hover:bg-[#181a23] rounded transition-colors flex items-center flex-shrink-0 mt-1"
            title="Drag to reorder"
          >
            <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
            </svg>
          </div>

          <div className="flex-1 min-w-0 grid sm:grid-cols-[140px_1fr] gap-2 sm:gap-3">
          <div>
            <Label className="text-xs font-medium text-secondary-foreground mb-1">
              {getTimeLabel()}
            </Label>
            <TimePicker
              value={formatTimeForPicker(location.time)}
              onChange={(value) => {
                onTimeChange(index, value);
              }}
              className="h-9"
            />
          </div>

          <div className="min-w-0 overflow-hidden">
            <Label className="text-xs font-medium text-secondary-foreground mb-1">Location</Label>
            {editingIndex === index && editingField === 'location' ? (
              <div className="editing-location" data-editing="true">
                <GoogleLocationSearch
                  currentLocation={`${location.location} - ${location.formattedAddress || location.location}`}
                  tripDestination={tripDestination}
                  onLocationSelect={(loc) => {
                    onLocationSelect(index, loc);
                    onEditEnd();
                  }}
                />
              </div>
            ) : (
              <div
                className="relative px-3 py-2 cursor-pointer hover:bg-muted dark:hover:bg-[#181a23] rounded-md border border-input bg-background transition-colors"
                onClick={() => onEditStart(index, 'location')}
                title={location.formattedAddress || location.location}
              >
                <div className="flex items-start gap-2 sm:gap-3">
                  <svg className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <div className="flex-1 min-w-0 overflow-hidden">
                    {(() => {
                      const fullAddr = location.formattedAddress || location.location;
                      const { businessName, restOfAddress } = formatLocationDisplay(fullAddr);
                      
                      // Truncate business name if too long
                      const maxBusinessNameLength = 40;
                      const displayBusinessName = (businessName || location.location || '').length > maxBusinessNameLength
                        ? (businessName || location.location || '').substring(0, maxBusinessNameLength) + '...'
                        : (businessName || location.location || '');
                      
                      // Truncate rest of address if too long
                      const maxRestLength = 50;
                      const displayRest = restOfAddress && restOfAddress.length > maxRestLength
                        ? restOfAddress.substring(0, maxRestLength) + '...'
                        : restOfAddress;

                      return (
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <div className="text-sm font-semibold text-card-foreground truncate" title={businessName || location.location}>
                            {displayBusinessName}
                          </div>
                          {displayRest && (
                            <div className="text-xs text-muted-foreground truncate" title={restOfAddress}>
                              {displayRest}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                  {location.verified && (
                    <svg className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {canRemove && (
          <button
            className="flex-shrink-0 p-2 text-muted-foreground hover:text-destructive transition-colors"
            onClick={() => onRemove(index)}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

export interface EditRouteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Form state
  editingTripDate: Date | undefined;
  editingLocations: any[];
  editingExtractedIndex: number | null;
  editingExtractedField: 'location' | 'time' | null;
  leadPassengerName: string;
  passengerCount: number;
  vehicleInfo: string;
  tripDestination: string | null;
  tripDataDestination: string | null;
  editedDriverNotes: string;
  isRegenerating: boolean;
  // State setters
  onTripDateChange: (date: Date | undefined) => void;
  onLocationsChange: (locations: any[]) => void;
  onEditingIndexChange: (index: number | null) => void;
  onEditingFieldChange: (field: 'location' | 'time' | null) => void;
  onLeadPassengerNameChange: (name: string) => void;
  onPassengerCountChange: (count: number) => void;
  onVehicleInfoChange: (info: string) => void;
  onEditedDriverNotesChange: (notes: string) => void;
  // Handlers
  onLocationSelect: (index: number, location: any) => void;
  onTimeChange: (index: number, time: string) => void;
  onLocationRemove: (index: number) => void;
  onAddLocation: () => void;
  onDragEnd: (event: DragEndEvent) => void;
  onSave: () => Promise<void>;
  // Sensors for drag and drop
  sensors: ReturnType<typeof useSensors>;
}

export function EditRouteModal({
  open,
  onOpenChange,
  editingTripDate,
  editingLocations,
  editingExtractedIndex,
  editingExtractedField,
  leadPassengerName,
  passengerCount,
  vehicleInfo,
  tripDestination,
  tripDataDestination,
  editedDriverNotes,
  isRegenerating,
  onTripDateChange,
  onLocationsChange,
  onEditingIndexChange,
  onEditingFieldChange,
  onLeadPassengerNameChange,
  onPassengerCountChange,
  onVehicleInfoChange,
  onEditedDriverNotesChange,
  onLocationSelect,
  onTimeChange,
  onLocationRemove,
  onAddLocation,
  onDragEnd,
  onSave,
  sensors,
}: EditRouteModalProps) {
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <div className="flex items-center justify-between mb-4">
            <DialogTitle className="text-lg sm:text-xl">Manual Form</DialogTitle>
            <Button
              onClick={() => onOpenChange(false)}
              variant="outline"
              size="sm"
              className="text-xs sm:text-sm"
            >
              <span className="hidden sm:inline">← Back</span>
              <span className="sm:hidden">Back</span>
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 sm:py-4">
          {/* Trip Details - Passenger Name, Number of Passengers, Vehicle, Trip Destination */}
          <div className="rounded-md p-3 sm:p-4 mb-4 sm:mb-6 bg-primary dark:bg-[#202020] border border-border">
            {/* Unified Grid for All Trip Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 sm:gap-4 mb-3 sm:mb-4">
              {/* Trip Date - spans 2 columns */}
              <div className="sm:col-span-2">
                <label htmlFor="tripDate" className="block text-sm font-medium text-primary-foreground dark:text-card-foreground mb-2">
                  Trip date
                </label>
                <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      id="tripDate"
                      type="button"
                      className={cn(
                        "w-full justify-start text-left font-normal bg-background",
                        !editingTripDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {editingTripDate ? format(editingTripDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-auto p-0 z-[100]"
                    align="start"
                    sideOffset={4}
                  >
                    <Calendar
                      mode="single"
                      selected={editingTripDate}
                      onSelect={(date) => {
                        if (date) {
                          onTripDateChange(date);
                          setDatePickerOpen(false);
                        }
                      }}
                      disabled={(date) => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        // Disable past dates - allow today or later
                        return date < today;
                      }}
                      defaultMonth={editingTripDate || new Date()}
                      showOutsideDays={false}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Trip Destination - spans 2 columns - READ-ONLY (for visualization only) */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-primary-foreground dark:text-card-foreground mb-2">
                  Trip destination
                </label>
                <Input
                  value={tripDestination || tripDataDestination || ''}
                  readOnly
                  disabled
                  className="bg-muted/50 border-border rounded-md h-9 text-foreground cursor-not-allowed"
                  placeholder="No destination set"
                />
                <p className="text-xs text-muted-foreground mt-1">Trip destination cannot be changed</p>
              </div>

              {/* Lead Passenger Name - spans 2 columns */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-primary-foreground dark:text-card-foreground mb-2">
                  Lead passenger name
                </label>
                <Input
                  value={leadPassengerName}
                  onChange={(e) => onLeadPassengerNameChange(e.target.value)}
                  placeholder="e.g., Mr. Smith"
                  className="bg-background border-border rounded-md h-9 text-foreground"
                />
              </div>

              {/* Number of Passengers - spans 1 column */}
              <div className="sm:col-span-1">
                <label className="block text-sm font-medium text-primary-foreground dark:text-card-foreground mb-2">
                  Number of Passengers
                </label>
                <PassengerPicker
                  value={passengerCount}
                  onChange={onPassengerCountChange}
                  className="h-9"
                />
              </div>

              {/* Vehicle - spans 1 column */}
              <div className="sm:col-span-1">
                <label className="block text-sm font-medium text-primary-foreground dark:text-card-foreground mb-2">
                  Vehicle
                </label>
                <Input
                  value={vehicleInfo}
                  onChange={(e) => onVehicleInfoChange(e.target.value)}
                  placeholder="e.g., Mercedes S-Class"
                  className="bg-background border-border rounded-md h-9 text-foreground"
                />
              </div>
            </div>
          </div>

          {/* Sortable Location Cards */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={editingLocations.map((loc) => loc.placeId || `fallback-${editingLocations.indexOf(loc)}`)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-4">
                {editingLocations.map((loc, index) => (
                  <SortableEditLocationItem
                    key={loc.placeId || `fallback-${index}`}
                    location={loc}
                    index={index}
                    totalLocations={editingLocations.length}
                    onLocationSelect={onLocationSelect}
                    onTimeChange={onTimeChange}
                    onRemove={onLocationRemove}
                    canRemove={editingLocations.length > 1}
                    editingIndex={editingExtractedIndex}
                    editingField={editingExtractedField}
                    tripDestination={tripDestination || undefined}
                    onEditStart={(index, field) => {
                      onEditingIndexChange(index);
                      onEditingFieldChange(field);
                    }}
                    onEditEnd={() => {
                      onEditingIndexChange(null);
                      onEditingFieldChange(null);
                    }}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {/* Add Location Button */}
          <div className="mt-4">
            <Button
              onClick={onAddLocation}
              variant="outline"
              size="lg"
              className="border-dashed"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Location
            </Button>
          </div>

          {/* Trip Notes Field */}
          <div className="mt-8 mb-4 rounded-md p-4 bg-primary dark:bg-[#1f1f21] border border-border">
            <label className="block text-sm font-medium text-primary-foreground dark:text-card-foreground mb-2">Trip Notes</label>
            <textarea
              value={editedDriverNotes || ''}
              onChange={(e) => onEditedDriverNotesChange(e.target.value)}
              placeholder="Additional notes, contact info, special instructions, etc."
              rows={6}
              className="w-full bg-background dark:bg-input/30 border-border rounded-md p-2 text-sm text-foreground dark:hover:bg-[#323236] transition-colors border resize-y focus:outline-none focus-visible:border-ring dark:focus-visible:border-[#323236]"
            />
          </div>
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isRegenerating}
          >
            Cancel
          </Button>
          <Button
            onClick={onSave}
            disabled={isRegenerating || editingLocations.length === 0}
            className="bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A]"
          >
            {isRegenerating ? (
              <>
                <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Updating...
              </>
            ) : (
              'Update trip'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

