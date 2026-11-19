import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// True only when real Supabase credentials are set in Vercel / .env.local.
// When false the app runs in local demo mode (browser storage only) and
// says so plainly on screen. It never pretends to be connected.
export const isSupabaseConfigured =
  SUPABASE_URL.startsWith('https://') &&
  SUPABASE_ANON_KEY.length > 10 &&
  !SUPABASE_URL.includes('your-project');

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;
