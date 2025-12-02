import { Button } from '@/components/ui/button';

export function CTASection() {
  return (
    <section className="py-32 px-4 sm:px-8 bg-background border-t border-border">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-5xl font-light mb-8 text-[#05060A] dark:text-white">Ready to streamline your roadshows?</h2>
        <p className="text-xl text-muted-foreground mb-12 font-light">
          Join thousands of professionals who trust Chauffs for their ground transportation needs.
        </p>
        <Button
          size="lg"
          className="bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A]"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          Plan your trip
        </Button>
      </div>
    </section>
  );
}

