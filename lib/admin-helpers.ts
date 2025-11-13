import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const ADMIN_EMAIL = 'gerard@drivania.com';

/**
 * Check if the current authenticated user is an admin (for API routes)
 * Pass the request object to get access to cookies
 */
export async function isAdmin(request: Request): Promise<boolean> {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader) {
      console.log('❌ No authorization header found');
      return false;
    }

    // Extract the token from "Bearer <token>"
    const token = authHeader.replace('Bearer ', '');
    
    if (!token) {
      console.log('❌ No token in authorization header');
      return false;
    }

    console.log('🔑 Token received, length:', token.length);

    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error) {
      console.log('❌ Error getting user:', error.message);
      return false;
    }
    
    if (!user) {
      console.log('❌ No user found');
      return false;
    }
    
    console.log('✅ User authenticated:', user.email);
    console.log('🔐 Is admin?', user.email === ADMIN_EMAIL);
    return user.email === ADMIN_EMAIL;
  } catch (error) {
    console.error('❌ Error checking admin status:', error);
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

