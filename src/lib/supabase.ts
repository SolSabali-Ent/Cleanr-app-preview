import { createClient } from '@supabase/supabase-js'

const publicHostMode = import.meta.env.VITE_PUBLIC_HOST_MODE === '1'

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  (publicHostMode ? 'https://offline.cleanr.invalid' : undefined)

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  (publicHostMode ? 'cleanr-public-host-offline' : undefined)

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

/**
 * Public-host mode is intentionally backend-free while the production
 * Supabase project is unavailable. Intercept requests before they ever hit
 * the network so the real Cleanr UI can render without DNS/REST errors.
 */
async function offlineSupabaseFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const request = input instanceof Request ? input : new Request(input, init)
  const url = new URL(request.url)
  const method = request.method.toUpperCase()

  const jsonResponse = (body: unknown, status = 200) =>
    new Response(method === 'HEAD' ? null : JSON.stringify(body), {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Content-Range': '0-0/0',
      },
    })

  if (url.pathname.startsWith('/auth/v1/')) {
    if (url.pathname.endsWith('/user')) {
      return jsonResponse({ user: null })
    }
    return jsonResponse({ session: null, user: null })
  }

  if (url.pathname.includes('/rpc/')) {
    return jsonResponse(null)
  }

  if (url.pathname.startsWith('/rest/v1/')) {
    return jsonResponse([])
  }

  if (url.pathname.startsWith('/storage/v1/')) {
    return jsonResponse([])
  }

  return jsonResponse(null)
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  ...(publicHostMode
    ? {
        global: { fetch: offlineSupabaseFetch },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      }
    : {}),
})
