'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useAuth } from '@/lib/auth-context';
import { useHomepageContext } from '@/lib/homepage-context';
import { getAdminEmail } from '@/lib/admin-helpers';
import { Button } from '@/components/ui/button';
import { Moon, Sun, Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export default function Header() {
  const { user, isAuthenticated, signOut, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { resetToImport } = useHomepageContext();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const handleSignOut = async () => {
    await signOut();
    setMobileMenuOpen(false);
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
    setMobileMenuOpen(false);
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
    <>
      <header className="fixed top-0 left-0 right-0 z-50 w-full bg-background">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            {/* Logo */}
            <button onClick={handleLogoClick} className="flex items-center cursor-pointer">
              <img 
                src={mounted && theme === 'dark' ? "/chauffs-logo-neg.png" : "/chauffs-logo-pos.png"}
                alt="Chauffs" 
                className="h-[1.7204rem] w-auto"
              />
            </button>
            
            {/* Desktop Navigation - Hidden on mobile */}
            <div className="hidden md:flex items-center gap-2">
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

            {/* Mobile Navigation - Theme Toggle + Hamburger */}
            <div className="flex md:hidden items-center gap-2">
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
              
              {/* Hamburger Menu Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="h-9 w-9 p-0"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      <div
        className={cn(
          'fixed inset-0 z-40 md:hidden transition-opacity duration-300',
          mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={() => setMobileMenuOpen(false)}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
        
        {/* Menu Panel */}
        <div
          className={cn(
            'absolute top-[73px] right-0 bottom-0 left-0 bg-background border-t border-border shadow-lg transition-transform duration-300 ease-in-out overflow-y-auto',
            mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="container mx-auto px-4 py-6">
            <div className="flex flex-col gap-4">
              {isAuthenticated ? (
                <>
                  {/* User Email */}
                  <div className="pb-4 border-b border-border">
                    <p className="text-sm text-muted-foreground">Signed in as</p>
                    <p className="text-sm font-medium text-foreground mt-1">{user?.email}</p>
                  </div>
                  
                  {/* Menu Items */}
                  <Link href="/my-trips" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="outline" size="lg" className="w-full justify-start">
                      My trips
                    </Button>
                  </Link>
                  
                  {user?.email === getAdminEmail() && (
                    <Link href="/admin" onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="outline" size="lg" className="w-full justify-start">
                        Analytics
                      </Button>
                    </Link>
                  )}
                  
                  <Button
                    onClick={handleSignOut}
                    variant="outline"
                    size="lg"
                    className="w-full justify-start"
                  >
                    Logout
                  </Button>
                </>
              ) : (
                <>
                  <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="outline" size="lg" className="w-full">
                      Login
                    </Button>
                  </Link>
                  <Link href="/signup" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="default" size="lg" className="w-full bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A]">
                      Sign up
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
