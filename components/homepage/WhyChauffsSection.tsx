import { ShieldCheck, Zap, Sparkles } from 'lucide-react';

export function WhyChauffsSection() {
  return (
    <section className="py-24 px-4 sm:px-8 bg-background border-t border-border">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-light mb-6 text-[#05060A] dark:text-white">Why Chauffs?</h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto font-light">
            Experience the future of roadshow planning with our AI-powered platform.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {/* Benefit 1 */}
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="p-4 rounded-full bg-primary/5 dark:bg-white/10 text-[#05060A] dark:text-white mb-2">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-semibold">Reliable & Safe</h3>
            <p className="text-muted-foreground">
              Vetted drivers and secure booking process ensure your peace of mind during every trip.
            </p>
          </div>

          {/* Benefit 2 */}
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="p-4 rounded-full bg-primary/5 dark:bg-white/10 text-[#05060A] dark:text-white mb-2">
              <Zap className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-semibold">Time Efficient</h3>
            <p className="text-muted-foreground">
              Save hours of planning time with our intelligent route optimization and instant quotes.
            </p>
          </div>

          {/* Benefit 3 */}
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="p-4 rounded-full bg-primary/5 dark:bg-white/10 text-[#05060A] dark:text-white mb-2">
              <Sparkles className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-semibold">Premium Experience</h3>
            <p className="text-muted-foreground">
              Access a fleet of luxury vehicles and professional chauffeurs for a first-class journey.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

