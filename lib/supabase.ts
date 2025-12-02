import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Validate environment variables (server-side only, no logging)
if (!supabaseUrl || !supabaseAnonKey) {
  if (process.env.NODE_ENV === 'development') {
    console.error('❌ Supabase environment variables not configured!');
    console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl || 'MISSING');
    console.error('   NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseAnonKey ? 'Present' : 'MISSING');
  }
  throw new Error('Supabase environment variables are required');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

