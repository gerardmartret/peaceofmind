'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useHomepageContext } from '@/lib/homepage-context';
import { Button } from '@/components/ui/button';

export default function Header() {
  const { user, isAuthenticated, signOut, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { resetToImport } = useHomepageContext();

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  const handleLogoClick = () => {
    if (pathname === '/' && resetToImport) {
      // If we're on the homepage and have a reset function, use it
      resetToImport();
    } else {
      // Otherwise, navigate to homepage
      router.push('/');
    }
  };

  if (loading) {
    return (
      <header className="w-full border-b" style={{ backgroundColor: '#FBFAF9' }}>
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-end items-center gap-2">
            <div className="h-9 w-20 bg-gray-200 animate-pulse rounded"></div>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="w-full border-b" style={{ backgroundColor: '#FBFAF9' }}>
      <div className="container mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <button onClick={handleLogoClick} className="flex items-center cursor-pointer">
            <img 
              src="/driverbrief-logo.png" 
              alt="Driverbrief" 
              className="h-6 w-auto"
            />
          </button>
          
          {/* Navigation */}
          <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <>
              <span className="text-sm mr-2" style={{ color: '#05060A' }}>
                {user?.email}
              </span>
              <Link href="/my-trips">
                <Button variant="outline" size="sm">
                  My Trips
                </Button>
              </Link>
              <Button
                onClick={handleSignOut}
                variant="outline"
                size="sm"
              >
                Logout
              </Button>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="outline" size="sm">
                  Login
                </Button>
              </Link>
              <Link href="/signup">
                <Button variant="default" size="sm">
                  Sign Up
                </Button>
              </Link>
            </>
          )}
          </div>
        </div>
      </div>
    </header>
  );
}

