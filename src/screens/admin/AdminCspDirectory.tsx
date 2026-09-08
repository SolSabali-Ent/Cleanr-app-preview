import { useEffect, useMemo, useState } from "react";
import { ExternalLink, ShieldCheck, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getSignedProfilePhotoUrl } from "../../lib/profilePhotoApi";
import { supabase } from "../../lib/supabase";
import {
  AdminEmptyState,
  AdminNotice,
  AdminPage,
  AdminPageHeader,
  AdminSearchField,
  AdminStatus,
  AdminTableShell,
  AdminTabs,
} from "./AdminUi";

type CspDirectoryRow = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  preferred_name: string | null;
  profile_photo_path: string | null;
  provider_bio: string | null;
  zip_code: string | null;
  service_radius_miles: number | null;
  service_area_labels: string[] | null;
  years_experience: number | null;
  languages: string[] | null;
  specialties: string[] | null;
  created_at: string;
  application_status: string | null;
  marketplace_access: boolean;
  is_onboarded: boolean;
  readiness_status: string | null;
  identity_status: string | null;
  background_check_status: string | null;
  insurance_status: string | null;
  screening_status: string | null;
  stripe_connect_ready: boolean;
  service_practice_state: string | null;
  completed_jobs: number;
  avg_rating: number | null;
  review_count: number;
  repeat_household_count: number;
  existing_client_relationship_count: number;
};

type DirectoryFilter = "all" | "marketplace" | "pending" | "approved_not_active" | "paused" | "former";

const FILTERS: Array<{ key: DirectoryFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "marketplace", label: "Marketplace" },
  { key: "pending", label: "Pending" },
  { key: "approved_not_active", label: "Approved / inactive" },
  { key: "paused", label: "Paused" },
  { key: "former", label: "Former" },
];

function displayName(row: CspDirectoryRow) {
  return row.preferred_name?.trim() || row.full_name?.trim() || [row.first_name, row.last_name].filter(Boolean).join(" ").trim() || "Unnamed CSP";
}

function servicePracticeLabel(state: string | null) {
  if (state === "active_cleaning_practice") return "Active practice";
  if (state === "temporarily_not_taking_cleaning_work") return "Paused";
  if (state === "no_longer_taking_cleaning_work") return "No longer cleaning";
  return "Practice unknown";
}

function applicationLabel(value: string | null) {
  if (!value) return "No application";
  return value.replaceAll("_", " ");
}

function isPending(row: CspDirectoryRow) {
  return !row.marketplace_access && !["approved", "rejected"].includes((row.application_status ?? "").toLowerCase());
}

function matchesFilter(row: CspDirectoryRow, filter: DirectoryFilter) {
  if (filter === "all") return true;
  if (filter === "marketplace") return row.marketplace_access;
  if (filter === "pending") return isPending(row);
  if (filter === "approved_not_active") return (row.application_status ?? "").toLowerCase() === "approved" && !row.marketplace_access;
  if (filter === "paused") return row.service_practice_state === "temporarily_not_taking_cleaning_work";
  return row.service_practice_state === "no_longer_taking_cleaning_work";
}

function trustCleared(value: string | null) {
  return ["clear", "approved", "verified", "complete", "completed"].includes((value ?? "").toLowerCase());
}

export function AdminCspDirectory() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<CspDirectoryRow[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<DirectoryFilter>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      const { data, error: rpcError } = await supabase.rpc("get_admin_csp_directory");
      if (!active) return;
      if (rpcError) {
        setRows([]);
        setError(rpcError.message);
        setLoading(false);
        return;
      }

      const nextRows = (data ?? []) as CspDirectoryRow[];
      setRows(nextRows);
      setLoading(false);

      const photoEntries = await Promise.all(
        nextRows
          .filter((row) => Boolean(row.profile_photo_path?.trim()))
          .map(async (row) => [row.id, await getSignedProfilePhotoUrl(row.profile_photo_path)] as const)
      );
      if (!active) return;
      setPhotoUrls(Object.fromEntries(photoEntries.filter((entry): entry is readonly [string, string] => Boolean(entry[1]))));
    }
    void load();
    return () => { active = false; };
  }, []);

  const counts = useMemo(() => Object.fromEntries(FILTERS.map(({ key }) => [key, rows.filter((row) => matchesFilter(row, key)).length])) as Record<DirectoryFilter, number>, [rows]);

  const visibleRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (!matchesFilter(row, filter)) return false;
      if (!needle) return true;
      return [displayName(row), row.full_name, row.first_name, row.last_name, row.preferred_name, row.zip_code, ...(row.service_area_labels ?? []), ...(row.languages ?? []), ...(row.specialties ?? [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [rows, filter, search]);

  return (
    <AdminPage width="wide">
      <AdminPageHeader
        eyebrow="People"
        title="CSP directory"
        description="Every CSP in the Cleanr ecosystem, regardless of current marketplace visibility."
        meta={<span className="text-xs text-slate-500">{rows.length} CSP{rows.length === 1 ? "" : "s"}</span>}
      />

      {error ? <AdminNotice tone="danger">{error}</AdminNotice> : null}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <AdminTabs
          value={filter}
          onChange={setFilter}
          items={FILTERS.map(({ key, label }) => ({ value: key, label, count: counts[key] ?? 0 }))}
        />
        <AdminSearchField value={search} onChange={setSearch} placeholder="Search name, ZIP, area, language, specialty…" className="w-full max-w-md" />
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">Loading CSP directory…</div>
      ) : visibleRows.length === 0 ? (
        <AdminEmptyState title="No CSPs match this view" />
      ) : (
        <AdminTableShell>
          <div className="grid grid-cols-[minmax(270px,1.4fr)_180px_minmax(250px,1.1fr)_210px_150px] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <span>CSP</span><span>Status</span><span>Service relationships</span><span>Trust</span><span className="text-right">Preview</span>
          </div>
          {visibleRows.map((row) => {
            const name = displayName(row);
            const initial = name.charAt(0).toUpperCase();
            const identityVerified = trustCleared(row.identity_status);
            const backgroundChecked = trustCleared(row.background_check_status);
            return (
              <div key={row.id} className="grid grid-cols-[minmax(270px,1.4fr)_180px_minmax(250px,1.1fr)_210px_150px] items-center gap-4 border-b border-slate-200 px-5 py-4 last:border-b-0">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 text-xs font-semibold text-slate-600">
                    {photoUrls[row.id] ? <img src={photoUrls[row.id]} alt="" className="h-full w-full object-cover" /> : initial}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-950">{name}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{row.zip_code ? `ZIP ${row.zip_code}` : "No ZIP"}{row.service_radius_miles ? ` · ${row.service_radius_miles} mi` : ""}</p>
                    {row.specialties?.length ? <p className="mt-1 truncate text-[11px] text-slate-400">{row.specialties.slice(0, 3).join(" · ")}</p> : null}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <AdminStatus tone={row.marketplace_access ? "success" : isPending(row) ? "warning" : "neutral"}>{row.marketplace_access ? "Marketplace" : applicationLabel(row.application_status)}</AdminStatus>
                  <p className="text-[11px] text-slate-500">{servicePracticeLabel(row.service_practice_state)}</p>
                </div>

                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div><p className="font-semibold text-slate-950">{row.completed_jobs}</p><p className="mt-0.5 text-[11px] text-slate-500">Cleans</p></div>
                  <div><p className="font-semibold text-slate-950">{row.repeat_household_count}</p><p className="mt-0.5 text-[11px] text-slate-500">Repeat homes</p></div>
                  <div><p className="font-semibold text-slate-950">{row.existing_client_relationship_count}</p><p className="mt-0.5 text-[11px] text-slate-500">Existing clients</p></div>
                  <div className="col-span-3 flex items-center gap-1 text-[11px] text-slate-500"><Star className="h-3 w-3" /> {row.avg_rating ?? "—"} · {row.review_count} reviews</div>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600">
                  <p className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> {identityVerified ? "Identity verified" : "Identity pending"}</p>
                  <p className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> {backgroundChecked ? "Background clear" : "Background pending"}</p>
                  <p className="text-[11px] text-slate-500">{row.stripe_connect_ready ? "Payout ready" : "Payout setup needed"}</p>
                </div>

                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => navigate(`/admin/device/customer/provider/${row.id}`)}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Customer view <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </AdminTableShell>
      )}
    </AdminPage>
  );
}
