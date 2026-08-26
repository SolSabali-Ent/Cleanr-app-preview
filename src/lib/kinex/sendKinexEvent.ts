const BRAND_SLUG = "cleanr";

const KINEX_URL = import.meta.env.VITE_KINEX_URL;
const KINEX_API_KEY = import.meta.env.VITE_KINEX_API_KEY;

export type SendKinexEventParams = {
  event_type: string;
  person_id: string;
  occurred_at: string;
  payload?: Record<string, unknown>;
};

/**
 * Sends a domain event to Kinex via the ingestion endpoint.
 * Logs progress and never throws; failures are logged only.
 */
export async function sendKinexEvent(params: SendKinexEventParams): Promise<unknown | null> {
  const { event_type, person_id, occurred_at, payload } = params;

  if (!KINEX_URL) {
    console.warn("[kinex_event_send_failed] VITE_KINEX_URL is not set");
    return null;
  }

  console.info("[kinex_event_send_started]", { event_type, person_id });

  try {
    const body = {
      events: [
        {
          event_type,
          brand_slug: BRAND_SLUG,
          person_id,
          occurred_at,
          payload: payload ?? {},
        },
      ],
    };

    const res = await fetch(KINEX_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(KINEX_API_KEY ? { Authorization: `Bearer ${KINEX_API_KEY}` } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[kinex_event_send_failed]", {
        event_type,
        status: res.status,
        statusText: res.statusText,
        body: text,
      });
      return null;
    }

    const contentType = res.headers.get("Content-Type");
    const isJson = contentType?.includes("application/json") ?? false;
    const parsed = isJson ? await res.json() : await res.text();

    console.info("[kinex_event_send_success]", { event_type, person_id });
    return parsed;
  } catch (err) {
    console.error("[kinex_event_send_failed]", { event_type, person_id, error: err });
    return null;
  }
}
