import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Debug logging
if (typeof window !== 'undefined') {
  console.log('🔧 Supabase Client Initialization:');
  console.log('   URL:', supabaseUrl);
  console.log('   Key:', supabaseAnonKey ? '✅ Present' : '❌ Missing');
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Supabase environment variables not configured!');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl || 'MISSING');
  console.error('   NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseAnonKey ? 'Present' : 'MISSING');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

