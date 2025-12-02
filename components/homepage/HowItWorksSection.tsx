import { Map, Users, Activity } from 'lucide-react';

export function HowItWorksSection() {
  return (
    <section className="py-24 px-4 sm:px-8 bg-background border-t border-border">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-light mb-6 text-[#05060A] dark:text-white">How it works?</h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto font-light">
            Three simple steps to organize your perfect roadshow.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {/* Connecting Line (Desktop only) */}
          <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-0.5 bg-border -z-10"></div>

          {/* Step 1 */}
          <div className="flex flex-col items-center text-center bg-background p-6">
            <div className="w-24 h-24 rounded-full bg-card border border-border flex items-center justify-center mb-6 shadow-sm z-10">
              <Map className="w-10 h-10 text-[#05060A] dark:text-white" />
            </div>
            <h3 className="text-xl font-semibold mb-2">1. Plan the trip</h3>
            <p className="text-muted-foreground">
              Enter your itinerary or upload a file. Our AI extracts locations and optimizes the route.
            </p>
          </div>

          {/* Step 2 */}
          <div className="flex flex-col items-center text-center bg-background p-6">
            <div className="w-24 h-24 rounded-full bg-card border border-border flex items-center justify-center mb-6 shadow-sm z-10">
              <Users className="w-10 h-10 text-[#05060A] dark:text-white" />
            </div>
            <h3 className="text-xl font-semibold mb-2">2. Quote drivers</h3>
            <p className="text-muted-foreground">
              Get instant quotes from our network of verified professional chauffeurs.
            </p>
          </div>

          {/* Step 3 */}
          <div className="flex flex-col items-center text-center bg-background p-6">
            <div className="w-24 h-24 rounded-full bg-card border border-border flex items-center justify-center mb-6 shadow-sm z-10">
              <Activity className="w-10 h-10 text-[#05060A] dark:text-white" />
            </div>
            <h3 className="text-xl font-semibold mb-2">3. Realtime updates</h3>
            <p className="text-muted-foreground">
              Track your ride in real-time and receive status updates throughout your journey.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

