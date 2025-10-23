import { supabase } from './supabase';

/**
 * Get the current authenticated user
 */
export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  return { user, error };
}

/**
 * Get the current session
 */
export async function getCurrentSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  return { session, error };
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const { user } = await getCurrentUser();
  return !!user;
}

/**
 * Get authenticated user's email
 */
export async function getAuthUserEmail(): Promise<string | null> {
  const { user } = await getCurrentUser();
  return user?.email ?? null;
}

/**
 * Get authenticated user's ID
 */
export async function getAuthUserId(): Promise<string | null> {
  const { user } = await getCurrentUser();
  return user?.id ?? null;
}

