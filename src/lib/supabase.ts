import { createClient } from '@supabase/supabase-js'

const publicHostMode = import.meta.env.VITE_PUBLIC_HOST_MODE === '1'
const configuredSupabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const configuredSupabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined
const configuredLegacyAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const configuredSupabaseKey = configuredSupabasePublishableKey ?? configuredLegacyAnonKey

/**
 * GitHub Pages is allowed to use the live Cleanr backend when browser-safe Supabase
 * configuration is supplied at build time. Offline mode is only a fallback for local/public
 * UI previews that genuinely have no backend configuration.
 */
export const isOfflinePreviewMode = Boolean(
  (publicHostMode || import.meta.env.DEV) && (!configuredSupabaseUrl || !configuredSupabaseKey)
)

const supabaseUrl =
  configuredSupabaseUrl ||
  (isOfflinePreviewMode ? 'https://offline.cleanr.invalid' : undefined)

const supabaseKey =
  configuredSupabaseKey ||
  (isOfflinePreviewMode ? 'cleanr-preview-offline' : undefined)

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables')
}

/**
 * Offline preview transport. It intercepts requests before they hit the network
 * so the UI can still render in explicit no-backend preview contexts.
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

export const supabase = createClient(supabaseUrl, supabaseKey, {
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

type PasswordSignInResult = {
  error: { message: string } | null
}

/**
 * Keep public-preview auth behavior aligned with the source app. This retries only the
 * parser-level "Auth session or user missing" edge case and still lets Supabase own all
 * invalid-credential and other auth errors.
 */
export async function signInWithPasswordResilient(email: string, password: string): Promise<PasswordSignInResult> {
  const normalizedEmail = email.trim()
  const firstAttempt = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  })

  if (!firstAttempt.error) return { error: null }
  if (firstAttempt.error.message !== 'Auth session or user missing' || isOfflinePreviewMode) {
    return { error: firstAttempt.error }
  }

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: normalizedEmail, password }),
    })

    const payload = (await response.json().catch(() => null)) as
      | {
          access_token?: string
          refresh_token?: string
          error_description?: string
          msg?: string
          message?: string
        }
      | null

    if (!response.ok) {
      return {
        error: {
          message:
            payload?.error_description || payload?.msg || payload?.message || 'Unable to sign in. Please try again.',
        },
      }
    }

    if (!payload?.access_token || !payload.refresh_token) {
      return { error: firstAttempt.error }
    }

    const { error: setSessionError } = await supabase.auth.setSession({
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
    })

    return { error: setSessionError }
  } catch {
    return { error: firstAttempt.error }
  }
}
