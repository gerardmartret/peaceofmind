export function DemoSection() {
  return (
    <section className="py-24 px-4 sm:px-8 bg-background border-t border-border">
      <div className="max-w-5xl mx-auto text-center">
        <h2 className="text-4xl font-light mb-12 text-[#05060A] dark:text-white">See it in action</h2>
        <div className="w-full rounded-xl border border-border shadow-lg overflow-hidden">
          <div style={{ position: 'relative', paddingBottom: '64.90384615384616%', height: 0 }}>
            <iframe 
              src="https://www.loom.com/embed/ecac0abaebce4752a513ed5bf1795561" 
              frameBorder="0" 
              allow="fullscreen; picture-in-picture" 
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
              title="Demo Video"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

