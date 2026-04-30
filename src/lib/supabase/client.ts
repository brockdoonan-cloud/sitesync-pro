import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    const missingConfigError = { message: 'Supabase browser client is not configured.' }
    const query = {
      select: () => query,
      insert: async () => ({ data: null, error: missingConfigError }),
      update: () => query,
      eq: () => query,
      in: () => query,
      order: () => query,
      limit: () => query,
      single: async () => ({ data: null, error: missingConfigError }),
      then: (resolve: (value: { data: null; error: typeof missingConfigError }) => void) => resolve({ data: null, error: missingConfigError }),
    }

    return {
      auth: {
        getUser: async () => ({ data: { user: null }, error: missingConfigError }),
        signInWithPassword: async () => ({ data: null, error: missingConfigError }),
        signUp: async () => ({ data: null, error: missingConfigError }),
        signOut: async () => ({ error: null }),
      },
      from: () => query,
    } as any
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
