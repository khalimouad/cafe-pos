import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

if (!url || !key) {
  throw new Error(
    'Configuration Supabase manquante : renseignez VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY dans .env',
  )
}

export const supabase = createClient(url, key, {
  auth: { persistSession: false },
  realtime: { params: { eventsPerSecond: 5 } },
})
