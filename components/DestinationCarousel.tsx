'use client';

import { useEffect, useState } from 'react';
import { ALLOWED_TRIP_DESTINATIONS } from '@/lib/city-helpers';

export default function DestinationCarousel() {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setOffset((prev) => {
        // Calculate item width including gap (approximately 80px per item with gap)
        const itemWidth = 80;
        const totalWidth = ALLOWED_TRIP_DESTINATIONS.length * itemWidth;
        // Move slowly by 1px per update
        const newOffset = prev - 1;
        return newOffset <= -totalWidth ? 0 : newOffset;
      });
    }, 50); // Update every 150ms for very slow, smooth animation (5x slower)

    return () => clearInterval(interval);
  }, []);

  // Duplicate destinations for seamless loop
  const duplicatedDestinations = [...ALLOWED_TRIP_DESTINATIONS, ...ALLOWED_TRIP_DESTINATIONS];

  return (
    <div className="relative w-full overflow-hidden">
      <div className="flex items-center">
        <div
          className="flex items-center gap-2 transition-transform duration-0 ease-linear"
          style={{
            transform: `translateX(${offset}px)`,
          }}
        >
          {duplicatedDestinations.map((destination, index) => (
            <div
              key={`${destination}-${index}`}
              className="inline-flex items-center justify-center rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 dark:bg-input/50 dark:text-foreground dark:hover:bg-input/60 px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors"
            >
              {destination}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
