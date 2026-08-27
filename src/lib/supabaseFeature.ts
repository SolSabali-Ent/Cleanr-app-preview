type SupabaseLikeError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

/**
 * During the pre-migration period, the app may be connected to a valid Supabase project whose
 * hosted schema does not yet contain newer Transformation tables/RPCs. Reads should fail closed
 * to empty durable state instead of making the whole screen unusable. Writes still stay disabled
 * and surface a clear feature-not-active message.
 */
export function isSupabaseFeatureUnavailable(error: SupabaseLikeError | null | undefined): boolean {
  if (!error) return false;

  const code = error.code ?? "";
  const text = `${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`.toLowerCase();

  return code === "42P01" // undefined_table
    || code === "42883" // undefined_function
    || code === "PGRST200" // relationship / embedded resource missing in schema cache
    || code === "PGRST202" // function missing in schema cache
    || code === "PGRST205" // table missing in schema cache
    || text.includes("could not find the function")
    || text.includes("schema cache")
    || text.includes("does not exist");
}

export function dormantFeatureError(label: string): Error {
  return new Error(`${label} is ready in the app but is not active on the connected backend yet.`);
}
