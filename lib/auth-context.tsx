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
  const [hasAttemptedWelcomeEmail, setHasAttemptedWelcomeEmail] = useState<Set<string>>(new Set());

  // Send welcome email when email is confirmed (only once per user)
  useEffect(() => {
    const sendWelcomeEmailIfNeeded = async (currentUser: User | null) => {
      if (!currentUser || !currentUser.email_confirmed_at) {
        return;
      }

      // Check if we've already attempted to send welcome email for this user in this session
      if (hasAttemptedWelcomeEmail.has(currentUser.id)) {
        return;
      }

      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (!currentSession) {
          return;
        }

        // Mark as attempted immediately to prevent duplicate calls
        setHasAttemptedWelcomeEmail((prev) => new Set(prev).add(currentUser.id));

        const response = await fetch('/api/send-welcome-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentSession.access_token}`,
          },
          body: JSON.stringify({ userId: currentUser.id }),
        });

        if (response.ok) {
          const result = await response.json();
          if (process.env.NODE_ENV === 'development') {
            if (result.alreadySent) {
              console.log('⚠️ Welcome email was already sent previously');
            } else {
              console.log('✅ Welcome email sent');
            }
          }
        } else {
          // If it failed, remove from attempted set so we can retry later if needed
          setHasAttemptedWelcomeEmail((prev) => {
            const next = new Set(prev);
            next.delete(currentUser.id);
            return next;
          });
          // Don't log errors for welcome email - it's not critical
          if (process.env.NODE_ENV === 'development') {
            const result = await response.json();
            console.log('⚠️ Welcome email not sent:', result.error);
          }
        }
      } catch (error) {
        // If it failed, remove from attempted set so we can retry later if needed
        setHasAttemptedWelcomeEmail((prev) => {
          const next = new Set(prev);
          next.delete(currentUser.id);
          return next;
        });
        // Silently fail - welcome email is not critical
        if (process.env.NODE_ENV === 'development') {
          console.log('⚠️ Failed to send welcome email:', error);
        }
      }
    };

    if (user && user.email_confirmed_at) {
      sendWelcomeEmailIfNeeded(user);
    }
    // Only depend on user, not hasAttemptedWelcomeEmail to avoid re-runs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

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
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      
      // Sync to users table if signup successful
      if (!error && data.user) {
        await supabase
          .from('users')
          .upsert({
            email: email,
            auth_user_id: data.user.id,
            marketing_consent: true,
          }, { onConflict: 'email' });
      }
      
      return { error };
    } catch (error) {
      return { error: error as AuthError };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      // Sync to users table if login successful
      if (!error && data.user) {
        await supabase
          .from('users')
          .upsert({
            email: email,
            auth_user_id: data.user.id,
          }, { onConflict: 'email' });
      }
      
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

