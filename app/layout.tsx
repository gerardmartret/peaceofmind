import type { Metadata } from "next";
import { Inter } from "next/font/google";
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
  title: "Driverbrief - Roadshow planner",
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
            </HomepageProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
