import { supabase } from "../lib/supabase";

function coerceAvailabilityResult(data: unknown): boolean {
  if (typeof data === "boolean") return data;

  if (Array.isArray(data) && data.length > 0) {
    const first = data[0] as Record<string, unknown>;
    if (typeof first?.is_available === "boolean") return first.is_available;
    if (typeof first?.available === "boolean") return first.available;
  }

  if (data && typeof data === "object") {
    const row = data as Record<string, unknown>;
    if (typeof row.is_available === "boolean") return row.is_available;
    if (typeof row.available === "boolean") return row.available;
  }

  return Boolean(data);
}

export async function isProviderAvailable(
  providerId: string,
  startISO: string,
  endISO: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_provider_available_v1", {
    p_provider_id: providerId,
    p_start: startISO,
    p_end: endISO,
  });

  if (error) {
    throw error;
  }

  return coerceAvailabilityResult(data);
}
