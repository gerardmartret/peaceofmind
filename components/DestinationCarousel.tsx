'use client';

import { ALLOWED_TRIP_DESTINATIONS } from '@/lib/city-helpers';

export default function DestinationCarousel() {
  return (
    <div className="w-full">
      {/* Desktop: Grid layout */}
      <div className="hidden sm:block">
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
          {ALLOWED_TRIP_DESTINATIONS.map((destination) => (
            <span
              key={destination}
              className="whitespace-nowrap hover:text-foreground transition-colors text-center"
            >
              {destination}
            </span>
          ))}
        </div>
      </div>

      {/* Mobile: Compact flowing text with separators */}
      <div className="block sm:hidden">
        <div className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-[10px] text-muted-foreground leading-relaxed">
          {ALLOWED_TRIP_DESTINATIONS.map((destination, index) => (
            <span key={destination}>
              <span className="hover:text-foreground transition-colors whitespace-nowrap">
                {destination}
              </span>
              {index < ALLOWED_TRIP_DESTINATIONS.length - 1 && (
                <span className="text-muted-foreground/40 mx-0.5">•</span>
              )}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
