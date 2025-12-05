import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface RegenerationStep {
  id: string;
  title: string;
  description: string;
  source: string;
  status: 'pending' | 'loading' | 'completed' | 'error';
}

interface RegenerationLoadingModalProps {
  isRegenerating: boolean;
  regenerationProgress: number;
  regenerationSteps: RegenerationStep[];
  error: string | null;
  onClose: () => void;
}

export function RegenerationLoadingModal({
  isRegenerating,
  regenerationProgress,
  regenerationSteps,
  error,
  onClose,
}: RegenerationLoadingModalProps) {
  if (!isRegenerating) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[80] p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] shadow-2xl animate-in fade-in zoom-in duration-300 overflow-y-auto flex items-center justify-center">
        <CardContent className="px-8 py-12 w-full">
          <div className="space-y-8">
            {/* Circular Progress Indicator */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative w-32 h-32">
                {/* Background Circle */}
                <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 120 120">
                  <circle
                    cx="60"
                    cy="60"
                    r="54"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    className="text-secondary dark:text-[#2a2a2c]"
                  />
                  {/* Progress Circle */}
                  <circle
                    cx="60"
                    cy="60"
                    r="54"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray="339.292"
                    strokeDashoffset={339.292 * (1 - regenerationProgress / 100)}
                    className={regenerationProgress >= 100 ? 'text-green-500' : 'text-[#05060A] dark:text-[#E5E7EF]'}
                    strokeLinecap="round"
                  />
                </svg>
                {/* Percentage Text */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-3xl font-bold">{Math.round(regenerationProgress)}%</span>
                </div>
              </div>
              <div className="text-center">
                <h3 className="text-xl font-semibold mb-1">Updating trip</h3>
                <p className="text-sm text-muted-foreground">
                  {regenerationSteps.filter((s) => s.status === 'completed').length} of {regenerationSteps.length} steps
                  completed
                </p>
              </div>
            </div>

            {/* Steps Carousel - Exact Homepage Animation */}
            <div className="relative h-[200px] overflow-hidden flex items-center justify-center">
              {regenerationProgress >= 100 ? (
                // Completion View - Show redirect message
                <div className="w-full animate-in fade-in-0 slide-in-from-bottom-4 duration-700">
                  <div className="flex flex-col items-center justify-center gap-3 mt-8">
                    <svg className="animate-spin h-12 w-12 text-muted-foreground" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <h3 className="text-lg font-semibold text-card-foreground">Redirecting to brief</h3>
                  </div>
                </div>
              ) : (
                // Carousel View - Show current and previous steps only
                regenerationSteps.map((step, index) => {
                  const isActive = step.status === 'loading';
                  const isCompleted = step.status === 'completed';
                  const isPending = step.status === 'pending';

                  // Calculate position relative to active step
                  const activeIndex = regenerationSteps.findIndex((s) => s.status === 'loading');

                  // If no active step (all completed), don't render any steps
                  if (activeIndex === -1) {
                    return null;
                  }

                  const position = index - activeIndex;

                  // Determine visibility and styling
                  let transform = '';
                  let opacity = 0;
                  let scale = 0.85;
                  let zIndex = 0;
                  let blur = 'blur(4px)';

                  if (position === 0) {
                    // Active step - center
                    transform = 'translateY(0)';
                    opacity = 1;
                    scale = 1;
                    zIndex = 30;
                    blur = 'blur(0)';
                  } else if (position === -1) {
                    // Previous step - hide completely (no watermark)
                    transform = 'translateY(-120px)';
                    opacity = 0;
                    scale = 0.85;
                    zIndex = 10;
                  } else if (position === 1) {
                    // Next step - hide completely (no watermark)
                    transform = 'translateY(120px)';
                    opacity = 0;
                    scale = 0.85;
                    zIndex = 10;
                  } else if (position < -1) {
                    // Steps further above
                    transform = 'translateY(-120px)';
                    opacity = 0;
                    scale = 0.85;
                    zIndex = 10;
                  } else {
                    // Steps further below
                    transform = 'translateY(120px)';
                    opacity = 0;
                    scale = 0.85;
                    zIndex = 10;
                  }

                  return (
                    <div
                      key={step.id}
                      className="absolute inset-x-0 top-1/2 -translate-y-1/2 transition-all duration-700 ease-in-out"
                      style={{
                        transform: `${transform} scale(${scale})`,
                        opacity: opacity,
                        zIndex: zIndex,
                        filter: blur,
                      }}
                    >
                      <div
                        className={`flex items-start gap-4 p-4 rounded-lg border ${
                          isActive
                            ? 'border-[#05060A] dark:border-[#E5E7EF] bg-[#05060A]/10 dark:bg-[#E5E7EF]/10'
                            : isCompleted
                              ? 'border-green-500/30 bg-green-500/5'
                              : 'border-border bg-muted/30'
                        }`}
                      >
                        {/* Status Icon */}
                        <div className="flex-shrink-0 mt-0.5" style={{ isolation: 'isolate' }}>
                          {isPending && <div className="w-6 h-6 rounded-full border-2 border-muted-foreground/30"></div>}
                          {isActive && (
                            <div
                              className="w-6 h-6 rounded-full border-2 border-[#05060A] border-t-transparent"
                              style={{
                                animation: 'spin 1s linear infinite',
                                willChange: 'transform',
                              }}
                            ></div>
                          )}
                          {isCompleted && (
                            <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </div>

                        {/* Step Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <h4 className={`text-base font-semibold ${isActive ? 'text-[#05060A] dark:text-[#E5E7EF]' : ''}`}>
                              {step.title}
                            </h4>
                            <span className="text-xs font-medium text-[#05060A] dark:text-[#E5E7EF] bg-secondary dark:bg-[#2a2a2c] px-2 py-1 rounded whitespace-nowrap flex-shrink-0">
                              {step.source}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-semibold">❌ Error during update</p>
                  <p className="text-sm">{error}</p>
                  <Button onClick={onClose} variant="outline" size="sm" className="mt-2">
                    Close
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


