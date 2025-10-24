import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { HomepageProvider } from "@/lib/homepage-context";
import Header from "@/components/Header";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Peace of Mind - Trip Safety Planner",
  description: "Plan safer trips in London with real-time safety insights",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} antialiased`}
      >
        <AuthProvider>
          <HomepageProvider>
            <Header />
            <div className="pt-20">
              {children}
            </div>
          </HomepageProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
