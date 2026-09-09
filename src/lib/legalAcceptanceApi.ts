import { supabase } from "./supabase";

export type CheckoutLegalDocument = {
  document_key: string;
  version: string;
  content_hash: string;
  title: string;
  url: string | null;
  effective_at: string;
  sort_order: number;
};

function normalizeDocument(value: unknown): CheckoutLegalDocument | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const documentKey = String(row.document_key ?? "").trim();
  const version = String(row.version ?? "").trim();
  const contentHash = String(row.content_hash ?? "").trim();
  const title = String(row.title ?? documentKey).trim();
  if (!documentKey || !version || !contentHash || !title) return null;
  return {
    document_key: documentKey,
    version,
    content_hash: contentHash,
    title,
    url: typeof row.url === "string" && row.url.trim() ? row.url.trim() : null,
    effective_at: String(row.effective_at ?? ""),
    sort_order: Number.isFinite(Number(row.sort_order)) ? Number(row.sort_order) : 100,
  };
}

export async function getCheckoutLegalDocuments(): Promise<CheckoutLegalDocument[]> {
  const { data, error } = await supabase.rpc("get_checkout_legal_documents");
  if (error) throw error;
  if (!Array.isArray(data)) return [];
  return data.map(normalizeDocument).filter((row): row is CheckoutLegalDocument => Boolean(row));
}

export async function acceptCheckoutLegalDocuments(documents: CheckoutLegalDocument[]): Promise<void> {
  for (const document of documents) {
    const { error } = await supabase.rpc("accept_published_legal_document", {
      p_document_key: document.document_key,
      p_version: document.version,
      p_user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    });
    if (error) throw error;
  }
}
