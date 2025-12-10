import React from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { determineVehicleType, extractCarInfo } from '../utils/vehicle-detection-helpers';
import { getDisplayVehicle } from '@/lib/vehicle-helpers';

interface DriverQuotesModalProps {
  open: boolean;
  onClose: () => void;
  assignOnlyMode: boolean;
  onAssignOnlyModeChange: (mode: boolean) => void;
  tripStatus: string;
  tripId: string;
  isOwner: boolean;
  driverEmail: string | null;
  
  // Driver input state
  manualDriverEmail: string;
  manualDriverError: string | null;
  allocateDriverEmailError: string | null;
  showDriverSuggestions: boolean;
  driverSuggestions: string[];
  filteredDriverSuggestions: string[];
  onManualDriverInputChange: (value: string) => void;
  onManualDriverInputFocus: () => void;
  onSelectDriverSuggestion: (driver: string) => void;
  
  // Actions state
  settingDriver: boolean;
  sendingQuoteRequest: boolean;
  
  // Messages
  quoteRequestSuccess: string | null;
  quoteRequestError: string | null;
  
  // Quotes data
  quotes: Array<{
    id: string;
    email: string;
    price: number;
    currency: string;
    created_at: string;
  }>;
  loadingQuotes: boolean;
  sentDriverEmails: Array<{
    email: string;
    sentAt: string;
  }>;
  
  // Flow modals
  onShowFlowAModal: (driverEmail: string) => void;
  onShowFlowBModal: (driverEmail: string) => void;
  
  // Handlers
  onSendQuoteRequest: (email: string) => void;
  onCloseDriverSuggestions: () => void;
  
  // Chauffs quote info
  lowestDrivaniaPrice: number | null;
  drivaniaCurrency: string | null;
  lowestExtraHourPrice: number | null;
  loadingDrivaniaQuote: boolean;
  
  // Vehicle info
  vehicleInfo: string;
  driverNotes: string;
  passengerCount: number;
  tripDestination: string;
  
  // Trip info
  leadPassengerName: string;
  tripDate: string;
  locations: Array<{ id?: string; name?: string; time: string; [key: string]: any }>;
}

export function DriverQuotesModal({
  open,
  onClose,
  assignOnlyMode,
  onAssignOnlyModeChange,
  tripStatus,
  tripId,
  isOwner,
  driverEmail,
  manualDriverEmail,
  manualDriverError,
  allocateDriverEmailError,
  showDriverSuggestions,
  driverSuggestions,
  filteredDriverSuggestions,
  onManualDriverInputChange,
  onManualDriverInputFocus,
  onSelectDriverSuggestion,
  settingDriver,
  sendingQuoteRequest,
  quoteRequestSuccess,
  quoteRequestError,
  quotes,
  loadingQuotes,
  sentDriverEmails,
  onShowFlowAModal,
  onShowFlowBModal,
  onSendQuoteRequest,
  onCloseDriverSuggestions,
  lowestDrivaniaPrice,
  drivaniaCurrency,
  lowestExtraHourPrice,
  loadingDrivaniaQuote,
  vehicleInfo,
  driverNotes,
  passengerCount,
  tripDestination,
  leadPassengerName,
  tripDate,
  locations,
}: DriverQuotesModalProps) {
  const router = useRouter();
  const { theme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);
  
  const vehicleType = determineVehicleType(vehicleInfo, driverNotes, passengerCount, tripDestination);
  const numberOfPassengers = passengerCount || 1;

  // Calculate trip duration
  const calculateTripDuration = (): string => {
    if (locations && locations.length >= 2) {
      const pickupTime = parseInt(locations[0]?.time) || 0;
      const dropoffTime = parseInt(locations[locations.length - 1]?.time) || 0;
      const duration = dropoffTime - pickupTime;

      if (duration > 0) {
        const hours = Math.floor(duration);
        const minutes = Math.round((duration - hours) * 60);
        return `${hours}h ${minutes}m`;
      } else {
        return 'Same day';
      }
    }
    return 'N/A';
  };

  // Get vehicle display name
  const getVehicleDisplayName = (): string => {
    // If signature sedan, check if specific brand/model was mentioned
    if (vehicleType === 'signature-sedan') {
      const requestedVehicle = vehicleInfo || extractCarInfo(driverNotes) || '';
      const vehicleText = (vehicleInfo || driverNotes || '').toLowerCase();
      
      // Check if specific luxury models are mentioned
      const hasSpecificModel = 
        /(?:mercedes|merc)\s*maybach\s*s/i.test(vehicleText) ||
        /rolls\s*royce\s*ghost/i.test(vehicleText) ||
        /rolls\s*royce\s*phantom/i.test(vehicleText);
      
      // If specific model mentioned, show it; otherwise show "Signature Sedan"
      if (hasSpecificModel && requestedVehicle) {
        return getDisplayVehicle(requestedVehicle, numberOfPassengers);
      } else {
        return 'Signature Sedan';
      }
    }
    
    // First, try to get vehicle from vehicleInfo field or driverNotes
    const requestedVehicle = vehicleInfo || extractCarInfo(driverNotes);

    // Use the helper to determine what to display:
    // - If vehicle is empty or not in whitelist, show auto-selected vehicle
    // - If vehicle is in whitelist, show that vehicle
    return getDisplayVehicle(requestedVehicle, numberOfPassengers);
  };

  // Get vehicle image path (always dark mode)
  const getVehicleImagePath = (): string => {
    const vehicleText = (vehicleInfo || driverNotes || '').toLowerCase();
    const isMaybachSClass = 
      /(?:mercedes|merc)\s*maybach\s*s(?:[\s-]*class)?/i.test(vehicleText) ||
      /maybach\s*(?:mercedes|merc)\s*s(?:[\s-]*class)?/i.test(vehicleText);
    
    // If it's Maybach S-Class, use S-Class image
    if (isMaybachSClass) {
      return "/Vehicles/dark-brief-sclass-web.png";
    }
    
    // Always use dark mode images
    return vehicleType === 'van' 
      ? "/Vehicles/dark-brief-vclass-web.png"
      : vehicleType === 'minibus' 
        ? "/Vehicles/dark-brief-sprinter-web.png"
        : vehicleType === 'luxury-suv'
          ? "/Vehicles/dark-brief-range-web.png"
          : vehicleType === 'suv' 
            ? "/Vehicles/dark-brief-escalade-web.png"
            : vehicleType === 'signature-sedan'
              ? "/Vehicles/dark-brief-phantom-web.png"
              : vehicleType === 'premium-sedan'
                ? "/Vehicles/dark-brief-sclass-web.png"
                : vehicleType === 'comfort-sedan'
                  ? "/Vehicles/dark-brief-camry-web.png"
                  : "/Vehicles/dark-brief-eclass-web.png";
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
    onClose();
    onAssignOnlyModeChange(false); // Reset assign-only mode
    }
  };

  const handleAssignDriver = (email: string) => {
    if (!email.trim()) return;
    if (tripStatus === 'cancelled') {
      alert('This trip has been cancelled. Please create a new trip instead.');
      return;
    }
    onShowFlowBModal(email);
  };

  const handleSelectQuoteDriver = (email: string) => {
    if (tripStatus === 'cancelled') {
      alert('This trip has been cancelled. Please create a new trip instead.');
      return;
    }
    onShowFlowAModal(email);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[1800px] min-w-[800px] sm:min-w-[1000px] max-h-[90vh] overflow-hidden flex flex-col p-0 relative">
        <DialogHeader className="relative p-4 sm:p-6 pb-3 sm:pb-4 border-b border-border flex-shrink-0">
          {/* Driver assigned indicator - Top Right */}
          {driverEmail && driverEmail !== 'drivania' && (
            <div className="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center gap-2 z-10">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-[#3ea34b]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm sm:text-base font-medium text-[#3ea34b]">Driver assigned</span>
          </div>
          )}
          <DialogTitle className="text-lg sm:text-xl flex items-center gap-2">
            {!assignOnlyMode && (
              <img
                src={theme === 'dark' ? "/driver-fav-light.svg" : "/driver-fav-dark.svg"}
                alt="Driver"
                className="w-[18px] h-[18px] sm:w-[21.6px] sm:h-[21.6px] flex-shrink-0"
              />
            )}
            {assignOnlyMode ? 'Assign driver' : 'Assign your own driver'}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-1">
            Enter your driver's email to assign or request a quote
          </DialogDescription>
        </DialogHeader>

        {/* Modal Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-0">
          {/* Cancelled Trip Warning */}
          {tripStatus === 'cancelled' && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription className="flex items-center gap-2">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <p className="font-semibold">This trip has been cancelled</p>
                  <p className="text-sm mt-1">You cannot assign drivers or request quotes for a cancelled trip. Please create a new trip instead.</p>
                </div>
              </AlertDescription>
            </Alert>
          )}


          {/* Driver Management Section - Unified */}
          <div className="mb-8">
            {assignOnlyMode && (
              <p className="text-muted-foreground mb-6">
                Assign a driver to confirm this trip
              </p>
            )}

            {/* Error Messages */}
            {(quoteRequestError || manualDriverError) && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{quoteRequestError || manualDriverError}</AlertDescription>
              </Alert>
            )}

            {/* Unified Email Input with Two Buttons */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                <div className="relative flex-1 min-w-0">
                  <Input
                    id="driver-email-unified"
                    type="email"
                    value={manualDriverEmail}
                    onChange={(e) => onManualDriverInputChange(e.target.value)}
                    onFocus={onManualDriverInputFocus}
                    onBlur={() => setTimeout(() => {
                      onCloseDriverSuggestions();
                    }, 200)}
                    placeholder="Enter driver email"
                    disabled={settingDriver || sendingQuoteRequest}
                    className={`text-sm sm:text-base ${(manualDriverError || allocateDriverEmailError) ? 'border-destructive' : ''}`}
                  />

                  {/* Autocomplete Dropdown */}
                  {showDriverSuggestions && filteredDriverSuggestions.length > 0 && filteredDriverSuggestions.some(driver => driver.toLowerCase() !== manualDriverEmail.trim().toLowerCase()) && (
                    <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-auto">
                      {filteredDriverSuggestions
                        .filter(driver => driver.toLowerCase() !== manualDriverEmail.trim().toLowerCase())
                        .map((driver, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => onSelectDriverSuggestion(driver)}
                          className="w-full text-left px-4 py-2 hover:bg-secondary/50 dark:hover:bg-[#181a23] transition-colors text-sm border-b last:border-b-0"
                        >
                          <div className="flex items-center justify-between">
                            <span>{driver}</span>
                            {driverEmail && driverEmail.toLowerCase() === driver.toLowerCase() && (
                              <span className="text-xs px-2 py-1 bg-[#3ea34b] text-white rounded">
                                Current
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Show message when no suggestions match */}
                  {showDriverSuggestions && manualDriverEmail.trim().length > 0 && filteredDriverSuggestions.length === 0 && driverSuggestions.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg p-4">
                      <p className="text-sm text-muted-foreground">No matching drivers found</p>
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto sm:ml-auto sm:justify-end">
                  {/* Request Quote - Hide in assign-only mode */}
                  {!assignOnlyMode && (
                    <Button
                      onClick={() => onSendQuoteRequest(manualDriverEmail)}
                      disabled={sendingQuoteRequest || !manualDriverEmail.trim() || settingDriver || tripStatus === 'cancelled'}
                      className="bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A] w-full sm:w-auto text-sm sm:text-base"
                    >
                      {sendingQuoteRequest ? (
                        <>
                          <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span className="hidden sm:inline">Sending...</span>
                          <span className="sm:hidden">Sending</span>
                        </>
                      ) : (
                        'Request quote'
                      )}
                    </Button>
                  )}

                  {/* Assign Driver - Show alongside Request quote when not in assign-only mode */}
                  {!assignOnlyMode && (
                    <Button
                      onClick={() => handleAssignDriver(manualDriverEmail)}
                      disabled={settingDriver || !manualDriverEmail.trim() || sendingQuoteRequest || tripStatus === 'cancelled'}
                      className="bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A] w-full sm:w-auto text-sm sm:text-base"
                    >
                      {settingDriver ? (
                        <>
                          <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 0 14 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span className="hidden sm:inline">Assigning...</span>
                          <span className="sm:hidden">Assigning</span>
                        </>
                      ) : (
                        'Assign driver'
                      )}
                    </Button>
                  )}

                  {/* Assign Driver - Only show in assign-only mode (Flow B) */}
                  {assignOnlyMode && (
                    <Button
                      onClick={() => handleAssignDriver(manualDriverEmail)}
                      disabled={settingDriver || !manualDriverEmail.trim() || sendingQuoteRequest || tripStatus === 'cancelled'}
                      className="bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A] w-full sm:w-auto text-sm sm:text-base"
                    >
                      {settingDriver ? (
                        <>
                          <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span className="hidden sm:inline">Assigning...</span>
                          <span className="sm:hidden">Assigning</span>
                        </>
                      ) : (
                        <span className="whitespace-normal sm:whitespace-nowrap">Assign driver & request acceptance</span>
                      )}
                    </Button>
                  )}
                </div>
              </div>

              {/* Error message below the input row */}
              {(manualDriverError || allocateDriverEmailError) && (
                <p className="text-sm text-destructive">{manualDriverError || allocateDriverEmailError}</p>
              )}

              {/* Unified Drivers List - Hide in assign-only mode */}
              {!assignOnlyMode && (sentDriverEmails.length > 0 || quotes.length > 0) && (
                <div className="mt-6 pt-6 border-t">
                  <h3 className="text-base sm:text-lg font-semibold mb-4">
                    Your drivers ({sentDriverEmails.length + quotes.filter(q => !sentDriverEmails.some(s => s.email.toLowerCase() === q.email.toLowerCase())).length})
                  </h3>
              {loadingQuotes ? (
                <div className="flex items-center justify-center py-8">
                  <svg className="animate-spin h-6 w-6 text-primary" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="ml-2 text-muted-foreground text-sm sm:text-base">Loading quotes...</span>
                </div>
              ) : (
                <>
                  {/* Desktop Table View */}
                  <div className="hidden sm:block overflow-x-auto -mx-4 sm:mx-0">
                    <div className="min-w-full inline-block align-middle">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="border-b">
                            <tr>
                              <th className="text-left py-3 px-4 font-semibold text-sm">Email</th>
                                  <th className="text-left py-3 px-4 font-semibold text-sm">Status</th>
                              <th className="text-right py-3 px-4 font-semibold text-sm">Price</th>
                              <th className="text-left py-3 px-4 font-semibold text-sm">Currency</th>
                              <th className="text-left py-3 px-4 font-semibold text-sm">Date</th>
                                  <th className="text-center py-3 px-4 font-semibold text-sm">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                                {/* Combine sent invitations and quotes into unified list */}
                                {(() => {
                                  // Create a map of all drivers
                                  const driverMap = new Map<string, {
                                    email: string;
                                    sentAt?: string;
                                    quote?: typeof quotes[0];
                                    isDriver: boolean;
                                  }>();

                                  // Add sent invitations
                                  sentDriverEmails.forEach(sent => {
                                    driverMap.set(sent.email.toLowerCase(), {
                                      email: sent.email,
                                      sentAt: sent.sentAt,
                                      isDriver: driverEmail?.toLowerCase() === sent.email.toLowerCase() || false,
                                    });
                                  });

                                  // Add or update with quotes
                                  quotes.forEach(quote => {
                                    const existing = driverMap.get(quote.email.toLowerCase());
                                    if (existing) {
                                      existing.quote = quote;
                                    } else {
                                      driverMap.set(quote.email.toLowerCase(), {
                                        email: quote.email,
                                        quote: quote,
                                        isDriver: driverEmail?.toLowerCase() === quote.email.toLowerCase() || false,
                                      });
                                    }
                                  });

                                  // Convert to array and sort: quotes first, then by sent date
                                  return Array.from(driverMap.values()).sort((a, b) => {
                                    // Drivers with quotes first
                                    if (a.quote && !b.quote) return -1;
                                    if (!a.quote && b.quote) return 1;
                                    // Then by date (most recent first)
                                    const aDate = a.quote?.created_at || a.sentAt || '';
                                    const bDate = b.quote?.created_at || b.sentAt || '';
                                    return bDate.localeCompare(aDate);
                                  });
                                })().map((driver) => {
                                  const hasQuote = !!driver.quote;
                                  const isDriver = driver.isDriver;
                              return (
                                <tr
                                      key={driver.email}
                                  className={`border-b hover:bg-secondary/50 dark:hover:bg-[#181a23] transition-colors ${isDriver ? 'bg-[#3ea34b]/10 border-[#3ea34b]/30' : ''
                                    }`}
                                >
                                  <td className="py-3 px-4 text-sm">
                                        {driver.email}
                                      </td>
                                      <td className="py-3 px-4 text-sm">
                                        {hasQuote ? (
                                          <span className={`px-2 py-1 text-xs font-bold text-white rounded whitespace-nowrap ${isDriver ? 'bg-[#3ea34b]' : 'bg-[#e77500]'}`}>
                                            Quote received
                                          </span>
                                        ) : (
                                          <span className="px-2 py-1 text-xs font-medium text-muted-foreground dark:text-[#05060A] bg-muted dark:bg-muted rounded whitespace-nowrap">
                                            Sent
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-3 px-4 text-sm text-right font-medium">
                                        {hasQuote ? driver.quote!.price.toFixed(2) : '-'}
                                      </td>
                                      <td className="py-3 px-4 text-sm">
                                        {hasQuote ? driver.quote!.currency : '-'}
                                  </td>
                                  <td className="py-3 px-4 text-sm text-muted-foreground">
                                        {hasQuote 
                                          ? new Date(driver.quote!.created_at).toLocaleDateString()
                                          : driver.sentAt 
                                            ? new Date(driver.sentAt).toLocaleDateString()
                                            : '-'
                                        }
                                  </td>
                                  <td className="py-3 px-4 text-center">
                                        {isDriver ? (
                                          <span className="px-2 py-1 text-xs font-bold text-white bg-[#3ea34b] rounded whitespace-nowrap">
                                            DRIVER
                                          </span>
                                        ) : hasQuote ? (
                                    <Button
                                      size="sm"
                                            variant="default"
                                            onClick={() => handleSelectQuoteDriver(driver.email)}
                                            disabled={settingDriver || tripStatus === 'cancelled'}
                                    >
                                      {settingDriver ? (
                                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                      ) : (
                                        'Select driver'
                                      )}
                                    </Button>
                                        ) : (
                                          <span className="text-xs text-muted-foreground">Waiting for quote</span>
                                        )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                  {/* Mobile Card View */}
                  <div className="sm:hidden space-y-3">
                        {(() => {
                          // Create a map of all drivers (same logic as desktop)
                          const driverMap = new Map<string, {
                            email: string;
                            sentAt?: string;
                            quote?: typeof quotes[0];
                            isDriver: boolean;
                          }>();

                          sentDriverEmails.forEach(sent => {
                            driverMap.set(sent.email.toLowerCase(), {
                              email: sent.email,
                              sentAt: sent.sentAt,
                              isDriver: driverEmail?.toLowerCase() === sent.email.toLowerCase() || false,
                            });
                          });

                          quotes.forEach(quote => {
                            const existing = driverMap.get(quote.email.toLowerCase());
                            if (existing) {
                              existing.quote = quote;
                            } else {
                              driverMap.set(quote.email.toLowerCase(), {
                                email: quote.email,
                                quote: quote,
                                isDriver: driverEmail?.toLowerCase() === quote.email.toLowerCase() || false,
                              });
                            }
                          });

                          return Array.from(driverMap.values()).sort((a, b) => {
                            if (a.quote && !b.quote) return -1;
                            if (!a.quote && b.quote) return 1;
                            const aDate = a.quote?.created_at || a.sentAt || '';
                            const bDate = b.quote?.created_at || b.sentAt || '';
                            return bDate.localeCompare(aDate);
                          });
                        })().map((driver) => {
                          const hasQuote = !!driver.quote;
                          const isDriver = driver.isDriver;
                        return (
                            <Card
                              key={driver.email}
                              className={`shadow-sm ${isDriver ? 'bg-[#3ea34b]/10 border-[#3ea34b]/30' : hasQuote ? 'border-[#3ea34b]' : ''}`}
                          >
                              <CardContent className="p-4 sm:p-6">
                            <div className="mb-2">
                              <div className="flex items-start gap-2 mb-1">
                                    <p className="text-sm font-medium break-words flex-1 min-w-0">{driver.email}</p>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                      {hasQuote ? (
                                        <span className={`px-2 py-1 text-xs font-bold text-white rounded whitespace-nowrap ${isDriver ? 'bg-[#3ea34b]' : 'bg-[#e77500]'}`}>
                                          Quote received
                                        </span>
                                      ) : (
                                        <span className="px-2 py-1 text-xs font-medium text-muted-foreground dark:text-[#05060A] bg-muted dark:bg-muted rounded whitespace-nowrap">
                                          Sent
                                  </span>
                                )}
                              </div>
                            </div>
                                </div>
                                {hasQuote && (
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm mb-3">
                              <div className="flex-shrink-0">
                                <span className="text-muted-foreground">Price: </span>
                                      <span className="font-medium">{driver.quote!.price.toFixed(2)} {driver.quote!.currency}</span>
                              </div>
                              <div className="text-muted-foreground text-xs sm:text-sm">
                                      {new Date(driver.quote!.created_at).toLocaleDateString()}
                              </div>
                            </div>
                                )}
                                {!hasQuote && driver.sentAt && (
                                  <div className="text-xs text-muted-foreground mb-3">
                                    Sent {new Date(driver.sentAt).toLocaleDateString()}
                                  </div>
                                )}
                                {isDriver ? (
                                  <div className="flex justify-center">
                                    <span className="px-2 py-1 text-xs font-bold text-white bg-[#3ea34b] rounded whitespace-nowrap">
                                      DRIVER
                                    </span>
                                  </div>
                                ) : hasQuote ? (
                            <Button
                              size="sm"
                                    variant="default"
                                    onClick={() => handleSelectQuoteDriver(driver.email)}
                                    disabled={settingDriver || tripStatus === 'cancelled'}
                                    className="w-full text-sm"
                            >
                              {settingDriver ? (
                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                              ) : (
                                'Select driver'
                              )}
                            </Button>
                                ) : (
                                  <div className="text-xs text-muted-foreground text-center py-2">
                                    Waiting for quote
                          </div>
                                )}
                              </CardContent>
                            </Card>
                        );
                      })}
                    </div>
                </>
              )}
            </div>
          )}
            </div>
          </div>

          {/* Book with Chauffs Section - Link to booking page */}
          {isOwner && !assignOnlyMode && driverEmail !== 'drivania' && (
            <div className="mt-12 mb-0 -mx-4 sm:-mx-6">
              <Card className="shadow-none bg-[#161820] dark:bg-[#161820] relative w-full">
                <CardContent className="pt-0 pb-0 px-2 sm:pt-1 sm:pb-0 sm:px-3">
                <div className="flex flex-col gap-1">
                  <div className="flex flex-col gap-2 flex-shrink-0 -mt-4 sm:-mt-3">
                    <div className="flex flex-col gap-1 pl-4 sm:pl-6">
                      <span className="text-[21.6px] sm:text-[24px] font-semibold text-primary-foreground dark:text-card-foreground">
                        Book a Trusted Driver Now
                      </span>
                      <span className="text-sm text-primary-foreground/80 dark:text-card-foreground/80">
                        Secure your driver and get an instant confirmation
                      </span>
                    </div>
                    {/* Vehicle Image */}
                    <div className="flex justify-center sm:justify-start mt-0.5 sm:mt-1 -mb-2 sm:-mb-3 pb-0">
                      <img
                        src={getVehicleImagePath()}
                        alt="Vehicle"
                        className="h-[109.81px] sm:h-[146.41px] lg:h-[159.72px] w-auto object-contain"
                        style={{ maxWidth: 'none' }}
                      />
                    </div>
                  </div>
                  {/* Button - Top Right */}
                  <div className="absolute top-4 right-4 sm:top-6 sm:right-6 flex flex-col items-end gap-4">
                <Button
                  onClick={() => {
                    onClose();
                    router.push(`/booking/${tripId}`);
                  }}
                      className="bg-[#E5E7EF] dark:bg-[#E5E7EF] text-[#05060A] dark:text-[#05060A] hover:bg-[#E5E7EF]/90 dark:hover:bg-[#E5E7EF]/90 text-[16.1px] sm:text-[18.4px]"
                >
                      Book this trip
                </Button>
                {mounted && (
                  <div className="flex items-center justify-center gap-1.5">
                    <img 
                      src="/chauffs-seal-neg.png" 
                      alt="Chauffs Trusted Driver" 
                      className="h-[10.88px] sm:h-[13.6px] w-auto"
                    />
                    <span className="text-[9.6px] sm:text-[11.2px] font-medium text-primary-foreground dark:text-muted-foreground">Chauffs Trusted Driver</span>
                  </div>
                )}
              </div>
                  {/* Price - Bottom Right */}
                  {!loadingDrivaniaQuote && lowestDrivaniaPrice !== null && (
                    <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 flex flex-col gap-1 items-end">
                      <div className="text-xl sm:text-[1.62rem] font-medium text-primary-foreground dark:text-foreground">
                        {(() => {
                          const formattedNumber = new Intl.NumberFormat('en-GB', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }).format(lowestDrivaniaPrice);
                          return `${formattedNumber} ${drivaniaCurrency || 'USD'}`;
                        })()}
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-medium text-primary-foreground/80 dark:text-muted-foreground">
                        <svg className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>
                          Trip duration{' '}
                          <span className="text-xs sm:text-sm font-semibold ml-1 sm:ml-2 text-primary-foreground dark:text-card-foreground">
                            {calculateTripDuration()}
                          </span>
                        </span>
                      </div>
                      {lowestExtraHourPrice !== null && (
                        <div className="text-xs sm:text-sm font-medium text-white">
                          {(() => {
                            const formattedNumber = new Intl.NumberFormat('en-GB', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }).format(lowestExtraHourPrice);
                            return `${formattedNumber} ${drivaniaCurrency || 'USD'} per extra hour`;
                          })()}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

