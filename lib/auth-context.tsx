'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from './supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean; // Whether auth is still loading
  isAuthenticated: boolean;
  signUp: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasSentWelcomeEmail, setHasSentWelcomeEmail] = useState<Set<string>>(new Set());

  // Send welcome email when email is confirmed
  useEffect(() => {
    const sendWelcomeEmailIfNeeded = async (currentUser: User | null) => {
      if (!currentUser || !currentUser.email_confirmed_at) {
        return;
      }

      // Check if we've already sent welcome email for this user
      if (hasSentWelcomeEmail.has(currentUser.id)) {
        return;
      }

      // Check if email was just confirmed (has email_confirmed_at but we haven't sent email yet)
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (!currentSession) {
          return;
        }

        const response = await fetch('/api/send-welcome-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentSession.access_token}`,
          },
          body: JSON.stringify({ userId: currentUser.id }),
        });

        if (response.ok) {
          setHasSentWelcomeEmail((prev) => new Set(prev).add(currentUser.id));
          if (process.env.NODE_ENV === 'development') {
            console.log('✅ Welcome email sent');
          }
        } else {
          // Don't log errors for welcome email - it's not critical
          if (process.env.NODE_ENV === 'development') {
            const result = await response.json();
            console.log('⚠️ Welcome email not sent:', result.error);
          }
        }
      } catch (error) {
        // Silently fail - welcome email is not critical
        if (process.env.NODE_ENV === 'development') {
          console.log('⚠️ Failed to send welcome email:', error);
        }
      }
    };

    if (user && user.email_confirmed_at) {
      sendWelcomeEmailIfNeeded(user);
    }
  }, [user, hasSentWelcomeEmail]);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        // Handle refresh token errors - clear session state
        if (error.message?.includes('Refresh Token') || error.message?.includes('refresh_token')) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('⚠️ Refresh token error detected, clearing session:', error.message);
          }
          setSession(null);
          setUser(null);
        } else {
          if (process.env.NODE_ENV === 'development') {
            console.error('❌ Session error:', error.message);
          }
          // For other errors, still clear session to be safe
          setSession(null);
          setUser(null);
        }
      } else {
      setSession(session);
      setUser(session?.user ?? null);
      }
      setLoading(false);
    }).catch((err) => {
      // Fallback error handling for unexpected errors
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Unexpected session error:', err);
      }
      setSession(null);
      setUser(null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Session will be null on errors (including refresh token errors)
      // This is the correct behavior - Supabase automatically clears invalid sessions
      if (event === 'TOKEN_REFRESHED' && !session) {
        // Token refresh failed - session is null
        if (process.env.NODE_ENV === 'development') {
          console.warn('⚠️ Token refresh failed, session cleared');
        }
      }
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });
      return { error };
    } catch (error) {
      return { error: error as AuthError };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error };
    } catch (error) {
      // Handle network errors (e.g., "Failed to fetch")
      if (error instanceof Error) {
        // Check if it's a network error
        if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
          const networkError: AuthError = {
            message: 'Network error: Unable to connect to authentication server. Please check your internet connection and try again.',
            name: 'AuthApiError',
            status: 0,
          } as AuthError;
          return { error: networkError };
        }
      }
      return { error: error as AuthError };
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('❌ Sign out error:', error.message);
        }
        // Clear state even if signOut fails (e.g., invalid session)
        // This ensures UI updates correctly
        setSession(null);
        setUser(null);
      } else {
        // Sign out successful - state will be cleared by onAuthStateChange
        // But we can also clear it here for immediate UI update
        setSession(null);
        setUser(null);
      }
    } catch (err) {
      // Fallback error handling for unexpected errors
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Unexpected sign out error:', err);
      }
      // Always clear state on error to ensure UI updates
      setSession(null);
      setUser(null);
    }
  };

  const value = {
    user,
    session,
    loading,
    isAuthenticated: !!user,
    signUp,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

