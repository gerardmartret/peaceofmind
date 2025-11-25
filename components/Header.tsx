'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useAuth } from '@/lib/auth-context';
import { useHomepageContext } from '@/lib/homepage-context';
import { getAdminEmail } from '@/lib/admin-helpers';
import { Button } from '@/components/ui/button';
import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function Header() {
  const { user, isAuthenticated, signOut, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { resetToImport } = useHomepageContext();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

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
      <header className="fixed top-0 left-0 right-0 z-50 w-full bg-background">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-end items-center gap-2">
            <div className="h-9 w-20 bg-muted animate-pulse rounded"></div>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 w-full bg-background">
      <div className="container mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <button onClick={handleLogoClick} className="flex items-center cursor-pointer">
            <img 
              src={mounted && theme === 'dark' ? "/chauffs-logo-neg.png" : "/chauffs-logo-pos.png"}
              alt="Chauffs" 
              className="h-7 w-auto"
            />
          </button>
          
          {/* Navigation */}
          <div className="flex items-center gap-2">
            {/* Theme Toggle */}
            {mounted && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="h-9 w-9 p-0"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </Button>
            )}
            
            {isAuthenticated ? (
              <>
                <span className="text-sm mr-2 text-foreground">
                  {user?.email}
                </span>
                <Link href="/my-trips">
                  <Button variant="outline" size="sm">
                    My trips
                  </Button>
                </Link>
                {user?.email === getAdminEmail() && (
                  <Link href="/admin">
                    <Button variant="outline" size="sm">
                      Analytics
                    </Button>
                  </Link>
                )}
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
                  <Button variant="default" size="sm" className="bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A]">
                    Sign up
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

