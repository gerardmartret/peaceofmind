'use client';

import React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useMatchingDrivers } from '@/app/results/[id]/hooks/useMatchingDrivers';
import { useTripData } from './hooks/useTripData';
import { useDrivaniaQuotes } from './hooks/useDrivaniaQuotes';
import { useVehicleFiltering } from './hooks/useVehicleFiltering';
import { useVehicleSelection } from './hooks/useVehicleSelection';
import { LoadingState } from './components/LoadingState';
import { ErrorState } from './components/ErrorState';
import { BookingSummaryCard } from './components/BookingSummaryCard';
import { VehicleList } from './components/VehicleList';

export default function BookingPage() {
  const router = useRouter();
  const params = useParams();
  const tripId = params.tripId as string;
  const { user } = useAuth();

  // Load trip data
  const {
    tripData,
    loadingTripData,
    tripError,
    isOwner,
    ownershipChecked,
    authLoading,
  } = useTripData(tripId);

  // Fetch matching drivers
  const tripDestination = tripData?.trip_destination || '';
  const { matchingDrivers } = useMatchingDrivers({
    driverDestination: tripDestination,
  });

  // Fetch Drivania quotes
  const {
    loadingDrivaniaQuote,
    drivaniaQuotes,
    drivaniaError,
  } = useDrivaniaQuotes(tripData);

  // Vehicle filtering
  const preferredVehicleHint = tripData?.vehicle_info || tripData?.preferred_vehicle;
  const {
    preferredVehicles,
    displayVehicles,
    otherVehicles,
    showOtherVehicles,
    setShowOtherVehicles,
  } = useVehicleFiltering(drivaniaQuotes, preferredVehicleHint);

  // Vehicle selection
  const {
    vehicleSelections,
    setVehicleSelections,
    selectedVehicle,
    setSelectedVehicle,
    calculatePrice,
  } = useVehicleSelection();

  // Handle vehicle selection
  const handleVehicleSelect = (vehicle: any) => {
    setSelectedVehicle(vehicle);
  };

  // Handle continue to confirmation page
  const handleContinue = () => {
    if (!selectedVehicle) return;
    
    // Store vehicle data in sessionStorage along with service_id for validation
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(`selectedVehicle_${tripId}`, JSON.stringify({
        vehicle_id: selectedVehicle.vehicle_id,
        vehicle_type: selectedVehicle.vehicle_type,
        level_of_service: selectedVehicle.level_of_service,
        sale_price: selectedVehicle.sale_price,
        vehicle_image: selectedVehicle.vehicle_image,
        max_seating_capacity: selectedVehicle.max_seating_capacity,
        max_cargo_capacity: selectedVehicle.max_cargo_capacity,
        extra_hour: selectedVehicle.extra_hour,
        service_id: drivaniaQuotes?.service_id, // Store service_id to validate later
      }));
    }
    router.push(`/confirmation/${tripId}`);
  };

  // Handle driver toggle
  const handleDriverToggle = (vehicleId: string, driverId: string) => {
    setVehicleSelections((prev) => {
      const current = prev[vehicleId] || { isVehicleSelected: false, selectedDriverIds: [] };
      const isSelected = current.selectedDriverIds.includes(driverId);
      return {
        ...prev,
        [vehicleId]: {
          ...current,
          isVehicleSelected: false,
          selectedDriverIds: isSelected
            ? current.selectedDriverIds.filter((id) => id !== driverId)
            : [...current.selectedDriverIds, driverId],
        },
      };
    });
  };

  // Loading state - wait for auth and ownership check
  if (authLoading || loadingTripData || !ownershipChecked) {
    return <LoadingState />;
  }

  // Error state
  if (tripError || !tripData) {
    return (
      <ErrorState
        title="Trip Not Found"
        message={tripError || 'This trip could not be found.'}
        actionLabel="Go to Home"
        onAction={() => router.push('/')}
      />
    );
  }

  // Ownership check - redirect if not owner (shouldn't reach here due to redirect in useEffect, but safety check)
  if (!isOwner) {
    return (
      <ErrorState
        title="Access Denied"
        message="Only trip owners can access the booking page."
        actionLabel="View Trip Report"
        onAction={() => router.push(`/results/${tripId}`)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold">Book Your Trip</h1>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-4 sm:gap-6">
          {/* Left Column - 70% */}
          <div className="lg:col-span-7 order-2 lg:order-1">
            <div className="mb-8">
              <VehicleList
                loading={loadingDrivaniaQuote}
                error={drivaniaError}
                quotes={drivaniaQuotes}
                displayVehicles={displayVehicles}
                otherVehicles={otherVehicles}
                showOtherVehicles={showOtherVehicles}
                preferredVehicleHint={preferredVehicleHint}
                preferredVehiclesCount={preferredVehicles.length}
                matchingDrivers={matchingDrivers}
                vehicleSelections={vehicleSelections}
                currencyCode={drivaniaQuotes?.currency_code}
                selectedVehicle={selectedVehicle}
                onToggleOtherVehicles={() => setShowOtherVehicles(prev => !prev)}
                onDriverToggle={handleDriverToggle}
                onSelectVehicle={handleVehicleSelect}
                calculatePrice={calculatePrice}
                onBackToTripReport={() => router.push(`/results/${tripId}`)}
              />
            </div>
          </div>

          {/* Right Column - 30% */}
          <div className="lg:col-span-3 order-1 lg:order-2">
            <div className="lg:sticky lg:top-8">
              <BookingSummaryCard
                selectedVehicle={selectedVehicle}
                tripData={tripData}
                currencyCode={drivaniaQuotes?.currency_code}
                onRemove={() => setSelectedVehicle(null)}
                onContinue={handleContinue}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
