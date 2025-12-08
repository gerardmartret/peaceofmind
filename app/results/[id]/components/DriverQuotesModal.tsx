import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';

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
}: DriverQuotesModalProps) {
  const router = useRouter();

  if (!open) return null;

  const handleClose = () => {
    onClose();
    onAssignOnlyModeChange(false); // Reset assign-only mode
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
    <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4">
      <div className="bg-background rounded-none sm:rounded-lg shadow-2xl w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-4xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="p-4 sm:p-6 pb-3 sm:pb-4 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-lg sm:text-2xl font-semibold text-card-foreground">
              {assignOnlyMode ? 'Assign driver' : 'Get driver quotes'}
            </h2>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-secondary/50 rounded-md transition-colors flex-shrink-0"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Modal Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
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

          {/* Currently Assigned Driver Section */}
          {driverEmail && driverEmail !== 'drivania' && (
            <Alert className="mb-6 bg-[#3ea34b]/10 border-[#3ea34b]/30">
              <AlertDescription className="flex items-center gap-3">
                <svg className="w-5 h-5 flex-shrink-0 text-[#3ea34b]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <p className="font-semibold text-[#3ea34b]">Driver assigned</p>
                  <p className="text-sm mt-1 text-foreground">{driverEmail}</p>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Driver Management Section - Unified */}
          <div className="mb-8">
            {!assignOnlyMode && (
              <p className="text-muted-foreground mb-6">
                Request quotes from drivers. After receiving a quote, you can assign that driver to your trip.
              </p>
            )}

            {assignOnlyMode && (
              <p className="text-muted-foreground mb-6">
                Assign a driver to confirm this trip
              </p>
            )}

            {/* Success Messages */}
            {quoteRequestSuccess && (
              <Alert className="mb-4 bg-[#3ea34b]/10 border-[#3ea34b]/30">
                <AlertDescription className="text-[#3ea34b]">
                  ✅ {quoteRequestSuccess}
                </AlertDescription>
              </Alert>
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
                  {showDriverSuggestions && filteredDriverSuggestions.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-auto">
                      {filteredDriverSuggestions.map((driver, index) => (
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

                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
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

              {/* List of sent invitations - Hide in assign-only mode */}
              {!assignOnlyMode && sentDriverEmails.length > 0 && (
                <div className="mt-6 pt-6 border-t">
                  <h3 className="text-sm font-semibold mb-3">Sent ({sentDriverEmails.length})</h3>
                  <div className="space-y-2">
                    {sentDriverEmails.map((sent, index) => {
                      const hasQuote = quotes.some(q => q.email.toLowerCase() === sent.email.toLowerCase());
                      return (
                        <div
                          key={index}
                          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 p-3 rounded-md bg-secondary/50 border border-[#3ea34b]"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium break-words">{sent.email}</p>
                          </div>
                          <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-0 flex-shrink-0 sm:ml-4">
                            <div className="text-left sm:text-right">
                            <p className="text-xs text-muted-foreground">
                                <span className="hidden sm:inline">Sent {new Date(sent.sentAt).toLocaleDateString()} at {new Date(sent.sentAt).toLocaleTimeString()}</span>
                                <span className="sm:hidden">{new Date(sent.sentAt).toLocaleDateString()}</span>
                            </p>
                          </div>
                          {hasQuote && (
                              <span className="px-2 py-1 text-xs font-bold text-white bg-[#3ea34b] rounded whitespace-nowrap">
                              QUOTE RECEIVED
                            </span>
                          )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Received Quotes Section - Hide in assign-only mode */}
          {!assignOnlyMode && (
            <div className="mb-8">
              <h3 className="text-lg sm:text-xl font-semibold mb-4">Received</h3>
              {loadingQuotes ? (
                <div className="flex items-center justify-center py-8">
                  <svg className="animate-spin h-6 w-6 text-primary" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="ml-2 text-muted-foreground text-sm sm:text-base">Loading quotes...</span>
                </div>
              ) : quotes.length === 0 ? (
                <p className="text-muted-foreground text-center py-8 text-sm sm:text-base">No quotes received yet</p>
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
                              <th className="text-right py-3 px-4 font-semibold text-sm">Price</th>
                              <th className="text-left py-3 px-4 font-semibold text-sm">Currency</th>
                              <th className="text-left py-3 px-4 font-semibold text-sm">Date</th>
                              <th className="text-center py-3 px-4 font-semibold text-sm">Driver</th>
                            </tr>
                          </thead>
                          <tbody>
                            {quotes.map((quote) => {
                              const isDriver = driverEmail && driverEmail.toLowerCase() === quote.email.toLowerCase();
                              return (
                                <tr
                                  key={quote.id}
                                  className={`border-b hover:bg-secondary/50 dark:hover:bg-[#181a23] transition-colors ${isDriver ? 'bg-[#3ea34b]/10 border-[#3ea34b]/30' : ''
                                    }`}
                                >
                                  <td className="py-3 px-4 text-sm">
                                    {quote.email}
                                    {isDriver && (
                                      <span className="ml-2 px-2 py-1 text-xs font-bold text-white bg-[#3ea34b] rounded">
                                        DRIVER
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-3 px-4 text-sm text-right font-medium">
                                    {quote.price.toFixed(2)}
                                  </td>
                                  <td className="py-3 px-4 text-sm">{quote.currency}</td>
                                  <td className="py-3 px-4 text-sm text-muted-foreground">
                                    {new Date(quote.created_at).toLocaleDateString()}
                                  </td>
                                  <td className="py-3 px-4 text-center">
                                    <Button
                                      size="sm"
                                      variant={isDriver ? "outline" : "default"}
                                      onClick={() => handleSelectQuoteDriver(quote.email)}
                                      disabled={settingDriver || isDriver || tripStatus === 'cancelled'}
                                      className={isDriver ? "border-[#3ea34b] text-[#3ea34b] hover:bg-[#3ea34b]/10" : ""}
                                    >
                                      {settingDriver ? (
                                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                      ) : isDriver ? (
                                        '✓ Driver'
                                      ) : (
                                        'Select driver'
                                      )}
                                    </Button>
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
                      {quotes.map((quote) => {
                        const isDriver = driverEmail && driverEmail.toLowerCase() === quote.email.toLowerCase();
                        return (
                          <div
                            key={quote.id}
                            className={`p-4 sm:p-6 rounded-md border ${isDriver ? 'bg-[#3ea34b]/10 border-[#3ea34b]/30' : 'bg-secondary/50 border-border'}`}
                          >
                            <div className="mb-2">
                              <div className="flex items-start gap-2 mb-1">
                                <p className="text-sm font-medium break-words flex-1 min-w-0">{quote.email}</p>
                                {isDriver && (
                                  <span className="inline-block flex-shrink-0 px-2 py-1 text-xs font-bold text-white bg-[#3ea34b] rounded">
                                    DRIVER
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm mb-3">
                              <div className="flex-shrink-0">
                                <span className="text-muted-foreground">Price: </span>
                                <span className="font-medium">{quote.price.toFixed(2)} {quote.currency}</span>
                              </div>
                              <div className="text-muted-foreground text-xs sm:text-sm">
                                {new Date(quote.created_at).toLocaleDateString()}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant={isDriver ? "outline" : "default"}
                              onClick={() => handleSelectQuoteDriver(quote.email)}
                              disabled={settingDriver || isDriver || tripStatus === 'cancelled'}
                              className={`w-full text-sm ${isDriver ? "border-[#3ea34b] text-[#3ea34b] hover:bg-[#3ea34b]/10" : ""}`}
                            >
                              {settingDriver ? (
                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                              ) : isDriver ? (
                                '✓ Driver'
                              ) : (
                                'Select driver'
                              )}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                </>
              )}
            </div>
          )}

          {/* Book with Drivania Section - Link to booking page */}
          {isOwner && !assignOnlyMode && driverEmail !== 'drivania' && (
            <div className="mb-8">
              <div className="rounded-md border border-border bg-muted/40 p-4 sm:p-6 text-center">
                <h3 className="text-base sm:text-lg font-semibold text-card-foreground mb-2">
                  Book with Drivania
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground mb-4">
                  Get instant quotes and book your trip with our partner Drivania
                </p>
                <Button
                  onClick={() => {
                    onClose();
                    router.push(`/booking/${tripId}`);
                  }}
                  className="bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A] w-full sm:w-auto text-sm sm:text-base"
                >
                  Book a trip
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

