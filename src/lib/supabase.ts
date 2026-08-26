import { createClient } from '@supabase/supabase-js'

const publicHostMode = import.meta.env.VITE_PUBLIC_HOST_MODE === '1'
const configuredSupabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const configuredSupabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/**
 * The public preview must remain bootable while the production backend is unavailable.
 * - GitHub Pages uses VITE_PUBLIC_HOST_MODE=1.
 * - Local Vite dev also falls back offline when Supabase env vars are absent.
 * - If local dev has real env vars, it uses the real backend.
 */
export const isOfflinePreviewMode = Boolean(
  publicHostMode || (import.meta.env.DEV && (!configuredSupabaseUrl || !configuredSupabaseAnonKey))
)

const supabaseUrl =
  configuredSupabaseUrl ||
  (isOfflinePreviewMode ? 'https://offline.cleanr.invalid' : undefined)

const supabaseAnonKey =
  configuredSupabaseAnonKey ||
  (isOfflinePreviewMode ? 'cleanr-preview-offline' : undefined)

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

/**
 * Offline preview transport. It intercepts requests before they hit the network
 * so the real Cleanr UI can render with neutral empty product truth.
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
  ...(isOfflinePreviewMode
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
