import { createClient } from '@supabase/supabase-js'

const publicHostMode = import.meta.env.VITE_PUBLIC_HOST_MODE === '1'

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  (publicHostMode ? 'https://ueuqbcrdjcmucodhkaxm.supabase.co' : undefined)

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  (publicHostMode ? 'cleanr-public-host-offline' : undefined)

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
