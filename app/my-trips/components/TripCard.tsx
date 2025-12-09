'use client';

import Link from 'next/link';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Trip, getVehicleImagePath, getStatusBadge, generateTripName, getVehicleDisplayName } from '../utils/trip-helpers';

interface Quote {
  id: string;
  trip_id: string;
  email: string;
  price: number;
  currency: string;
}

interface TripCardProps {
  trip: Trip;
  quote: Quote | null;
  drivaniaQuote: Quote | null;
  showPrice: boolean;
  theme: 'light' | 'dark' | undefined;
  mounted: boolean;
}

export function TripCard({ trip, quote, drivaniaQuote, showPrice, theme, mounted }: TripCardProps) {
  const formatPrice = (price: number, currency: string) => {
    const formattedNumber = new Intl.NumberFormat('en-GB', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
    return `${formattedNumber} ${currency || 'GBP'}`;
  };

  const statusBadge = getStatusBadge(trip);
  
  // Determine colors based on variant (matching FlowHoverButton)
  const colors = statusBadge.variant === 'confirmed' 
    ? {
        bg: 'bg-[#3ea34b]',
        border: 'border-[#3ea34b]',
        text: 'text-white',
      }
    : statusBadge.variant === 'pending'
    ? {
        bg: 'bg-[#e77500]',
        border: 'border-[#e77500]',
        text: 'text-white',
      }
    : statusBadge.variant === 'cancelled'
    ? {
        bg: 'bg-[#9e201b]',
        border: 'border-[#9e201b]',
        text: 'text-white',
      }
    : statusBadge.variant === 'rejected'
    ? {
        bg: 'bg-black dark:bg-black',
        border: 'border-black dark:border-black',
        text: 'text-white',
      }
    : statusBadge.variant === 'request-quote-style'
    ? {
        bg: 'bg-background dark:bg-input/30',
        border: 'border-border dark:border-input',
        text: 'text-foreground',
      }
    : {
        bg: 'bg-[#9e201b]',
        border: 'border-[#9e201b]',
        text: 'text-white',
      };
  
  const shadowClass = statusBadge.variant === 'request-quote-style' ? 'shadow-xs' : '';
  const vehicleDisplayName = getVehicleDisplayName(trip);

  return (
    <Link href={`/results/${trip.id}`} className="block">
      <Card className="relative cursor-pointer shadow-none">
        <CardHeader className="px-3 sm:px-4 md:px-6 pt-3 sm:pt-4 pb-3 sm:pb-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 sm:gap-6">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base sm:text-lg font-semibold break-words">
                {generateTripName(trip)}
              </CardTitle>
              <div className="flex items-center gap-2 mt-2 sm:mt-3">
                <svg className="w-4 h-4 flex-shrink-0 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="hidden sm:inline text-xs sm:text-sm font-normal text-muted-foreground">
                  Trip date{' '}
                </span>
                <span className="text-sm sm:text-base font-semibold text-foreground sm:ml-1">
                  {trip.trip_date ? new Date(trip.trip_date).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                  }) : 'N/A'}
                </span>
              </div>
              {mounted && (
                <div className="flex items-end gap-3 sm:gap-6 pt-3 sm:pt-4">
                  <img
                    src={getVehicleImagePath(trip, theme, mounted)}
                    alt="Vehicle"
                    className="h-[60px] sm:h-[102px] md:h-[119px] w-auto flex-shrink-0"
                  />
                  <div className="flex flex-col gap-2 pb-1 min-w-0">
                    {/* Passenger Count */}
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 flex-shrink-0 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <span className="hidden sm:inline text-xs sm:text-sm font-normal text-muted-foreground truncate">
                        Number of Passengers{' '}
                      </span>
                      <span className="text-sm sm:text-base font-semibold text-foreground sm:ml-1">
                        {trip.passenger_count || 1}
                      </span>
                    </div>
                    {/* Vehicle */}
                    <div className="flex items-center gap-1.5 min-w-0">
                      <svg className="w-4 h-4 flex-shrink-0 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                      </svg>
                      <span className="hidden sm:inline text-xs sm:text-sm font-normal text-muted-foreground truncate">
                        Vehicle{' '}
                      </span>
                      <span className="text-sm sm:text-base font-semibold text-foreground sm:ml-1">
                        {vehicleDisplayName}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="flex flex-row sm:flex-col items-start sm:items-end gap-2 sm:gap-3 flex-shrink-0">
              <div
                className={`relative z-0 flex items-center justify-center gap-2 overflow-hidden 
                  border ${colors.border} ${colors.bg} ${shadowClass}
                  h-9 sm:h-10 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-md ${colors.text} cursor-pointer whitespace-nowrap`}
              >
                <span className="truncate">{statusBadge.text}</span>
              </div>
              {showPrice && quote && (
                <div className="text-base sm:text-lg font-medium text-foreground whitespace-nowrap">
                  {formatPrice(quote.price, quote.currency)}
                </div>
              )}
              {(trip.status === 'booked' && trip.driver === 'drivania') && drivaniaQuote && (
                <div className="text-base sm:text-lg font-medium text-foreground whitespace-nowrap">
                  {formatPrice(drivaniaQuote.price, drivaniaQuote.currency)}
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        {mounted && (
          <div className="absolute bottom-3 sm:bottom-4 right-3 sm:right-6 flex items-center gap-2 text-[#05060A] dark:text-white font-medium text-xs sm:text-sm">
            <span className="hidden sm:inline">View trip</span>
            <span className="sm:hidden">View</span>
            <svg
              className="w-3 h-3 sm:w-4 sm:h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </div>
        )}
      </Card>
    </Link>
  );
}

