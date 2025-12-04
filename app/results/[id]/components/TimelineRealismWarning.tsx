import React from 'react';

interface TimelineRealismWarningProps {
  legRealism: {
    legIndex: number;
    realismLevel: 'realistic' | 'tight' | 'unrealistic';
    message: string;
  };
  isTripCompleted: () => boolean;
}

export const TimelineRealismWarning: React.FC<TimelineRealismWarningProps> = ({
  legRealism,
  isTripCompleted,
}) => {
  if (legRealism.realismLevel === 'realistic') {
    return null;
  }

  return (
    <div className="ml-9 mt-2 mb-1">
      <div
        className={`rounded-md p-3 border-l-4 cursor-pointer hover:opacity-80 transition-opacity ${
          legRealism.realismLevel === 'tight'
            ? 'bg-[#db7304]/10 border-[#db7304]'
            : 'bg-[#9e201b]/10 border-[#9e201b]'
        }`}
        onClick={() => {
          if (!isTripCompleted()) {
            // Scroll to trip breakdown section
            setTimeout(() => {
              const breakdownElement = document.getElementById('trip-breakdown-0');
              if (breakdownElement) {
                breakdownElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            }, 100);
          }
        }}
        title="Click to view trip breakdown"
      >
        <div
          className={`text-sm font-medium ${
            legRealism.realismLevel === 'tight' ? 'text-[#db7304]' : 'text-[#9e201b]'
          }`}
        >
          {legRealism.message}
        </div>
      </div>
    </div>
  );
};

