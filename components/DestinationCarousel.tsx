'use client';

import { ALLOWED_TRIP_DESTINATIONS } from '@/lib/city-helpers';

export default function DestinationCarousel() {
  return (
    <div className="w-full flex justify-center">
      <div className="flex items-center gap-1 sm:gap-2 flex-wrap justify-center">
        {ALLOWED_TRIP_DESTINATIONS.map((destination) => (
          <div
            key={destination}
            className="inline-flex items-center justify-center rounded sm:rounded-md border border-border dark:border-input bg-transparent text-foreground hover:border-foreground/50 dark:hover:border-foreground/50 px-2 py-1 sm:px-3 sm:py-1.5 text-[10px] sm:text-xs font-medium whitespace-nowrap transition-colors"
          >
            {destination}
          </div>
        ))}
      </div>
    </div>
  );
}
