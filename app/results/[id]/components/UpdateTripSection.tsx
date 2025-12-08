import React, { RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface UpdateTripSectionProps {
  updateText: string;
  setUpdateText: (text: string) => void;
  isExtracting: boolean;
  isRegenerating: boolean;
  updateProgress: {
    step: string;
    error: string | null;
    canRetry: boolean;
  };
  updateTextareaRef: RefObject<HTMLTextAreaElement | null>;
  handleExtractUpdates: () => void;
  scrollY: number;
  canUpdateTrip: boolean; // Use role-based permission instead of multiple flags
}

export function UpdateTripSection({
  updateText,
  setUpdateText,
  isExtracting,
  isRegenerating,
  updateProgress,
  updateTextareaRef,
  handleExtractUpdates,
  scrollY,
  canUpdateTrip,
}: UpdateTripSectionProps) {
  if (!canUpdateTrip || isRegenerating) {
    return null;
  }

  return (
    <div
      className={`relative sm:fixed left-0 right-0 bg-background transition-all duration-300 ${scrollY > 0 ? 'sm:top-0 sm:z-[60]' : 'sm:top-[57px] sm:z-40'}`}
    >
      <div className="container mx-auto px-3 sm:px-4 pt-4 sm:pt-8 pb-3">
        <div className="rounded-md px-3 sm:px-6 py-3 bg-primary dark:bg-[#1f1f21] border border-border">
          <label className="block text-sm font-medium text-primary-foreground dark:text-card-foreground mb-3">
            Trip update
          </label>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-start">
            <div className="flex-1 relative min-w-0">
              <textarea
                ref={updateTextareaRef}
                id="update-text"
                value={updateText}
                onChange={(e) => setUpdateText(e.target.value)}
                placeholder={
                  isExtracting && updateProgress.step && !updateProgress.error
                    ? `${updateProgress.step}...`
                    : 'Any changes to this trip? Tell updates to the AI planner to paste your email here.'
                }
                className="w-full min-h-[80px] sm:min-h-[51px] sm:h-[51px] px-3 py-3 rounded-md border border-border bg-background dark:bg-input/30 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus-visible:border-ring resize-none overflow-y-auto dark:hover:bg-[#323236] transition-colors dark:focus-visible:border-[#323236] text-sm sm:text-base"
                disabled={isExtracting || isRegenerating}
              />
            </div>

            <div className="flex items-center justify-end sm:justify-start gap-3 flex-shrink-0">
              <Button
                variant="default"
                className="flex items-center justify-center gap-2 h-10 sm:h-[51px] w-full sm:w-auto px-4 sm:px-6 bg-[#E5E7EF] text-[#05060A] hover:bg-[#E5E7EF]/90 text-sm sm:text-base"
                onClick={handleExtractUpdates}
                disabled={!updateText.trim() || isExtracting || isRegenerating}
              >
                {isExtracting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span className="hidden sm:inline">Updating...</span>
                    <span className="sm:hidden">Updating</span>
                  </>
                ) : (
                  'Update'
                )}
              </Button>
            </div>
          </div>

          {/* Enhanced Error Display with Step Information */}
          {updateProgress.error && (
            <Alert variant="destructive" className="mt-2">
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-semibold">❌ Failed at: {updateProgress.step}</p>
                  <p className="text-sm">{updateProgress.error}</p>
                  {updateProgress.canRetry && (
                    <Button onClick={handleExtractUpdates} variant="outline" size="sm" className="mt-2">
                      🔄 Retry
                    </Button>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    </div>
  );
}

