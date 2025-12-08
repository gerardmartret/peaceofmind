import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/admin-helpers';

export async function GET(request: Request) {
  try {
    // Verify admin access
    await requireAdmin(request);

    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '30d';

    // Calculate date range
    const now = new Date();
    let daysAgo = 30;
    if (timeRange === '7d') daysAgo = 7;
    else if (timeRange === '90d') daysAgo = 90;

    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - daysAgo);
    const startDateStr = startDate.toISOString();

    // Get service role key to access auth.users
    const serviceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      throw new Error('NEXT_SUPABASE_SERVICE_ROLE_KEY environment variable is not set');
    }

    // Create admin client with service role key to access auth.users
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Query auth.users table
    // Note: auth.users is accessed via the admin API
    const { data: authUsers, error } = await supabaseAdmin.auth.admin.listUsers();

    if (error) {
      throw new Error(`Failed to fetch auth users: ${error.message}`);
    }

    // Filter users by created_at within the time range
    const filteredUsers = (authUsers?.users || [])
      .filter((user) => {
        if (!user.created_at) return false;
        const userCreatedAt = new Date(user.created_at);
        return userCreatedAt >= startDate;
      })
      .map((user) => ({
        email: user.email || 'No email',
        created_at: user.created_at,
      }))
      .sort((a, b) => {
        // Sort by created_at descending (newest first)
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

    return NextResponse.json({
      success: true,
      data: {
        users: filteredUsers,
        count: filteredUsers.length,
        timeRange,
      },
    });
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Auth users error:', error);
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch auth users',
      },
      { status: error instanceof Error && error.message.includes('Unauthorized') ? 403 : 500 }
    );
  }
}
