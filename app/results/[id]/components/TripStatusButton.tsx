import React from 'react';
import { FlowHoverButton } from '@/components/ui/flow-hover-button';
import { useTheme } from 'next-themes';
import Image from 'next/image';

interface TripStatusButtonProps {
  tripStatus: string;
  driverResponseStatus: 'accepted' | 'rejected' | null;
  driverEmail: string | null;
  originalDriverEmail: string | null;
  quotes: Array<any>;
  sentDriverEmails: Array<any>;
  isOwner: boolean;
  quoteEmail: string;
  driverToken: string | null;
  validatedDriverEmail: string | null;
  updatingStatus: boolean;
  onStatusToggle: () => void;
  className?: string;
}

export const TripStatusButton: React.FC<TripStatusButtonProps> = ({
  tripStatus,
  driverResponseStatus,
  driverEmail,
  originalDriverEmail,
  quotes,
  sentDriverEmails,
  isOwner,
  quoteEmail,
  driverToken,
  validatedDriverEmail,
  updatingStatus,
  onStatusToggle,
  className,
}) => {
  const { theme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);
  // Determine if there was any activity (driver assigned, quotes requested, or quotes received)
  // Check both current state and original data to ensure we catch activity even if state changes
  const hasDriverInState = !!driverEmail;
  const hasDriverInOriginalData = !!originalDriverEmail;
  const hasQuotes = quotes.length > 0;
  const hasSentEmails = sentDriverEmails.length > 0;
  // Activity exists if driver was ever assigned OR quotes were requested/received
  const hasActivity = hasDriverInState || hasDriverInOriginalData || hasQuotes || hasSentEmails;

  // Check if user is the assigned driver (not owner)
  const isAssignedDriver = !isOwner && driverEmail && quoteEmail &&
    driverEmail.toLowerCase().trim() === quoteEmail.toLowerCase().trim();

  // Check if driver is viewing via token and matches assigned driver
  const isDriverViaToken = !isOwner && driverToken && validatedDriverEmail && driverEmail &&
    validatedDriverEmail.toLowerCase().trim() === driverEmail.toLowerCase().trim();

  // Check if driver is viewing and trip is pending
  const isDriverViewingPending = (isAssignedDriver || isDriverViaToken || !!(driverToken && validatedDriverEmail)) && tripStatus === 'pending';
  
  // Determine variant based on status and activity
  const getButtonVariant = () => {
    if (tripStatus === 'cancelled' && hasActivity) {
      return 'cancelled'; // Red, disabled
    }
    if (tripStatus === 'not confirmed' || (tripStatus === 'cancelled' && !hasActivity)) {
      return 'request-quote-style'; // Match request quote button colors/frame
    }
    // Driver response status takes priority
    if (driverResponseStatus === 'accepted') {
      return 'confirmed'; // Green
    }
    if (driverResponseStatus === 'rejected') {
      return 'rejected'; // Red
    }
    // All other statuses use existing variants
    return tripStatus === 'rejected' ? 'rejected' :
      tripStatus === 'confirmed' || tripStatus === 'booked' ? 'confirmed' :
        driverEmail ? 'pending' : 'not-confirmed';
  };

  const buttonVariant = getButtonVariant();
  const isCancelledWithActivity = tripStatus === 'cancelled' && hasActivity;
  
  const buttonText = isCancelledWithActivity ? 'Cancelled' :
    driverResponseStatus === 'rejected' ? 'Rejected' :
      driverResponseStatus === 'accepted' ? 'Trip accepted' :
        tripStatus === 'rejected' ? 'Rejected' :
          tripStatus === 'confirmed' ? 'Confirmed' :
            tripStatus === 'booked' ? 'Booked with' :
              isDriverViewingPending ? 'Accept trip' :
                driverEmail ? 'Pending' : 'Not confirmed';

  return (
    <FlowHoverButton
      variant={buttonVariant}
      size="sm"
      onClick={onStatusToggle}
      disabled={!!(updatingStatus || isCancelledWithActivity || (driverEmail === 'drivania' && tripStatus === 'booked') || (isDriverViewingPending && driverResponseStatus !== null))}
      className={className}
      icon={
        isCancelledWithActivity ? undefined : // No icon for cancelled
          driverResponseStatus === 'accepted' ? undefined : // No icon when driver accepted
            tripStatus === 'rejected' ? (
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            ) : tripStatus === 'booked' ? undefined : // No icon for booked with Drivania
              undefined
      }
    >
      {tripStatus === 'booked' ? (
        <span className="flex items-center justify-center gap-1.5">
          {buttonText}
          {mounted && (
            <img 
              src="/logo-drivania-neg.png" 
              alt="Drivania" 
              className="h-[13.2px] w-auto"
            />
          )}
        </span>
      ) : (
        buttonText
      )}
    </FlowHoverButton>
  );
};

