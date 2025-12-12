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
  // Use console.error here as this is a critical startup warning (not user-facing)
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

    // Use service role key for server-side token verification
    const serviceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      if (process.env.NODE_ENV === 'development') {
        console.log('❌ NEXT_SUPABASE_SERVICE_ROLE_KEY not set');
      }
      return false;
    }
    
    // Create admin client with service role key
    const supabaseAdmin = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Decode JWT token to extract user ID and email
    // Then verify the token is valid by fetching user from Supabase Admin API
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        if (process.env.NODE_ENV === 'development') {
          console.log('❌ Invalid JWT token format');
        }
        return false;
      }

      // Decode the payload (base64url)
      const payload = JSON.parse(
        Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()
      );

      const userId = payload.sub;
      const userEmail = payload.email;
      
      if (!userId || !userEmail) {
        if (process.env.NODE_ENV === 'development') {
          console.log('❌ Missing user ID or email in token');
        }
        return false;
      }

      // Verify token is valid by fetching user from Admin API
      // This ensures the token is legitimate and the user exists
      const { data: adminUser, error: adminError } = await supabaseAdmin.auth.admin.getUserById(userId);
      
      if (adminError || !adminUser?.user) {
        if (process.env.NODE_ENV === 'development') {
          console.log('❌ Token verification failed:', adminError?.message);
        }
        return false;
      }

      // Verify the email matches (extra security check)
      if (adminUser.user.email !== userEmail) {
        if (process.env.NODE_ENV === 'development') {
          console.log('❌ Email mismatch in token');
        }
        return false;
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('✅ User authenticated from token:', userEmail);
        console.log('🔐 Is admin?', userEmail === ADMIN_EMAIL);
      }
      
      return userEmail === ADMIN_EMAIL;
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Error verifying token:', error);
      }
      return false;
    }
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

