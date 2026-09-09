import { supabase } from "./supabase";

export type CustomerDisputeIssueType =
  | "service_quality"
  | "damage"
  | "injury"
  | "missing_item"
  | "billing"
  | "safety"
  | "other";

export type CustomerBookingDispute = {
  id: string;
  bookingId: string;
  issueType: CustomerDisputeIssueType;
  description: string;
  status: "open" | "under_review" | "resolved";
  createdAt: string;
};

function asDispute(data: unknown): CustomerBookingDispute {
  if (!data || typeof data !== "object") throw new Error("No dispute returned");
  const row = data as Record<string, unknown>;
  return {
    id: String(row.id ?? ""),
    bookingId: String(row.booking_id ?? ""),
    issueType: String(row.issue_type ?? "other") as CustomerDisputeIssueType,
    description: String(row.description ?? ""),
    status: String(row.status ?? "open") as CustomerBookingDispute["status"],
    createdAt: String(row.created_at ?? ""),
  };
}

export async function openCustomerBookingDispute(
  bookingId: string,
  issueType: CustomerDisputeIssueType,
  description: string
): Promise<CustomerBookingDispute> {
  const { data, error } = await supabase.rpc("open_customer_booking_dispute", {
    p_booking_id: bookingId,
    p_issue_type: issueType,
    p_description: description,
  });
  if (error) throw error;
  return asDispute(data);
}

export async function getActiveCustomerBookingDispute(
  bookingId: string
): Promise<CustomerBookingDispute | null> {
  const { data, error } = await supabase
    .from("disputes")
    .select("id,booking_id,issue_type,description,status,created_at")
    .eq("booking_id", bookingId)
    .in("status", ["open", "under_review"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? asDispute(data) : null;
}
