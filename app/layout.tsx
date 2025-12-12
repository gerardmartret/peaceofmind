import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { HomepageProvider } from "@/lib/homepage-context";
import { ThemeProvider } from "@/components/theme-provider";
import Header from "@/components/Header";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Chauffs - Roadshow planner",
  description: "Plan your roadshow with ease",
  icons: [
    {
      rel: 'icon',
      url: '/driver-fav-light.svg',
      media: '(prefers-color-scheme: dark)', // Light icon for dark mode
    },
    {
      rel: 'icon',
      url: '/driver-fav-dark.svg',
      media: '(prefers-color-scheme: light)', // Dark icon for light mode
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <AuthProvider>
            <HomepageProvider>
              <Header />
              <div className="pt-20">
                {children}
              </div>
              <footer className="py-6 text-center text-sm text-muted-foreground border-t border-border bg-background">
                <div className="container mx-auto px-4">
                  <span>© Chauffs 2025</span>
                  <span className="mx-2">·</span>
                  <Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link>
                  <span className="mx-2">·</span>
                  <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
                  <span className="mx-2">·</span>
                  <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
                </div>
              </footer>
            </HomepageProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
