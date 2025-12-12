'use client';

import { ALLOWED_TRIP_DESTINATIONS } from '@/lib/city-helpers';

export default function DestinationCarousel() {
  return (
    <div className="w-full flex justify-center">
      <div className="flex items-center gap-0.5 sm:gap-1 md:gap-2 flex-wrap justify-center max-h-[120px] sm:max-h-[140px] overflow-y-auto">
        {ALLOWED_TRIP_DESTINATIONS.map((destination) => (
          <div
            key={destination}
            className="inline-flex items-center justify-center rounded sm:rounded-md border border-border dark:border-input bg-transparent text-foreground hover:border-foreground/50 dark:hover:border-foreground/50 px-1.5 py-0.5 sm:px-2 sm:py-1 md:px-3 md:py-1.5 text-[9px] sm:text-[10px] md:text-xs font-medium whitespace-nowrap transition-colors"
          >
            {destination}
          </div>
        ))}
      </div>
    </div>
  );
}
