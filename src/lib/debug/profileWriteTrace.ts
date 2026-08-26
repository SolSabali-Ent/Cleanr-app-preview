import { supabase } from "@/lib/supabase";

type ProfileWriteTraceInput = {
  source: string;
  operation: "insert" | "upsert" | "update" | "rpc";
  targetId?: string | null;
  payload?: Record<string, unknown> | null;
  pathname?: string;
  /** Optional CSP onboarding snapshot for correlating with gate/routing (dev-only). */
  cspFlowState?: Record<string, unknown> | null;
};

export async function traceProfileWriteStart(input: ProfileWriteTraceInput) {
  if (!import.meta.env.DEV) return null;

  const { data } = await supabase.auth.getUser();
  const authUid = data.user?.id ?? null;

  const payloadKeys = input.payload ? Object.keys(input.payload).sort() : [];

  const event = {
    ts: new Date().toISOString(),
    source: input.source,
    operation: input.operation,
    authUid,
    targetId: input.targetId ?? null,
    targetMatchesAuth: input.targetId ? input.targetId === authUid : null,
    payloadKeys,
    pathname: input.pathname ?? (typeof window !== "undefined" ? window.location.pathname : undefined),
    cspFlowState: input.cspFlowState ?? null,
  };

  console.info("[profile-write-trace:start]", event);
  return event;
}

export function traceProfileWriteResult(
  startEvent: Awaited<ReturnType<typeof traceProfileWriteStart>>,
  result: { error?: unknown; data?: unknown },
) {
  if (!import.meta.env.DEV || !startEvent) return;

  const err = result.error as
    | { code?: string; message?: string; details?: string; hint?: string }
    | undefined;

  console.info("[profile-write-trace:result]", {
    ...startEvent,
    ok: !result.error,
    error: err
      ? {
          code: err.code,
          message: err.message,
          details: err.details,
          hint: err.hint,
        }
      : null,
  });
}
