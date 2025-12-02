export function DemoSection() {
  return (
    <section className="py-24 px-4 sm:px-8 bg-background border-t border-border">
      <div className="max-w-5xl mx-auto text-center">
        <h2 className="text-4xl font-light mb-12 text-[#05060A] dark:text-white">See it in action</h2>
        <div className="relative aspect-video w-full bg-card rounded-xl border border-border shadow-lg overflow-hidden flex items-center justify-center group cursor-pointer">
          <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 to-transparent opacity-50"></div>
          <div className="w-20 h-20 rounded-full bg-primary/90 text-primary-foreground flex items-center justify-center shadow-xl transition-transform transform group-hover:scale-110">
            <svg className="w-8 h-8 ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <p className="absolute bottom-8 text-muted-foreground font-medium">Watch Demo Video</p>
        </div>
      </div>
    </section>
  );
}

