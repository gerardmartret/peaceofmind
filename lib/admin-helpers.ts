import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

/**
 * Get admin email from environment variable
 * 
 * Uses NEXT_PUBLIC_ADMIN_EMAIL for both server and client.
 * Note: Admin email being public is acceptable since real security is enforced
 * server-side via requireAdmin() in API routes. Client-side checks are for UX only.
 * 
 * For enhanced security, you can set ADMIN_EMAIL (server-only) and NEXT_PUBLIC_ADMIN_EMAIL
 * separately, but both should match for consistency.
 */
const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'gerard@drivania.com';

// Warn in production if admin email is not set
if (!process.env.NEXT_PUBLIC_ADMIN_EMAIL && !process.env.ADMIN_EMAIL && process.env.NODE_ENV === 'production') {
  console.error('⚠️ NEXT_PUBLIC_ADMIN_EMAIL or ADMIN_EMAIL environment variable is not set! Admin access will not work correctly.');
}

/**
 * Check if the current authenticated user is an admin (for API routes)
 * Pass the request object to get access to cookies
 */
export async function isAdmin(request: Request): Promise<boolean> {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader) {
      if (process.env.NODE_ENV === 'development') {
        console.log('❌ No authorization header found');
      }
      return false;
    }

    // Extract the token from "Bearer <token>"
    const token = authHeader.replace('Bearer ', '');
    
    if (!token) {
      if (process.env.NODE_ENV === 'development') {
        console.log('❌ No token in authorization header');
      }
      return false;
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('🔑 Token received, length:', token.length);
    }

    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error) {
      if (process.env.NODE_ENV === 'development') {
        console.log('❌ Error getting user:', error.message);
      }
      return false;
    }
    
    if (!user) {
      if (process.env.NODE_ENV === 'development') {
        console.log('❌ No user found');
      }
      return false;
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ User authenticated:', user.email);
      console.log('🔐 Is admin?', user.email === ADMIN_EMAIL);
    }
    return user.email === ADMIN_EMAIL;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('❌ Error checking admin status:', error);
    }
    return false;
  }
}

/**
 * Require admin access - throws error if user is not admin
 * Use this in API routes to protect admin endpoints
 */
export async function requireAdmin(request: Request): Promise<void> {
  const admin = await isAdmin(request);
  
  if (!admin) {
    throw new Error('Unauthorized: Admin access required');
  }
}

/**
 * Get admin email for comparison
 */
export function getAdminEmail(): string {
  return ADMIN_EMAIL;
}

