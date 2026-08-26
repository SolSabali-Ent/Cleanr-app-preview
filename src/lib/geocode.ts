import { supabase } from "./supabase";

export interface GeocodeZipResult {
  zip: string;
  lat: number;
  lon: number;
  source: string;
}

/**
 * Call Edge Function to geocode ZIP and upsert into zip_geo_cache. Use after set_provider_location_from_zip returns zip_not_cached.
 */
export async function ensureZipCached(zip: string): Promise<GeocodeZipResult> {
  const { data, error } = await supabase.functions.invoke("geocode-zip", {
    body: { zip: zip.trim() },
  });
  if (error) throw new Error(error.message);
  const zipVal = data?.zip ?? zip.trim();
  const lat = Number(data?.lat);
  const lon = Number(data?.lon);
  const source = (data?.source ?? "nominatim") as string;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error("Could not geocode ZIP code");
  }
  return { zip: zipVal, lat, lon, source };
}
