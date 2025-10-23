'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';

export default function Header() {
  const { user, isAuthenticated, signOut, loading } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  if (loading) {
    return (
      <header className="w-full border-b bg-white">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-end items-center gap-2">
            <div className="h-9 w-20 bg-gray-200 animate-pulse rounded"></div>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="w-full border-b bg-white">
      <div className="container mx-auto px-4 py-4">
        <div className="flex justify-end items-center gap-2">
          {isAuthenticated ? (
            <>
              <span className="text-sm text-gray-600 mr-2">
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
    </header>
  );
}

