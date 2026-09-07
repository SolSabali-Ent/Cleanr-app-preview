import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Search, ShieldCheck, Star, UsersRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getSignedProfilePhotoUrl } from "../../lib/profilePhotoApi";
import { supabase } from "../../lib/supabase";
import { adminTheme } from "../../theme/adminTheme";

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
  { key: "marketplace", label: "Marketplace Active" },
  { key: "pending", label: "Pending" },
  { key: "approved_not_active", label: "Approved / Not Active" },
  { key: "paused", label: "Paused" },
  { key: "former", label: "No Longer Cleaning" },
];

function displayName(row: CspDirectoryRow) {
  return row.preferred_name?.trim() || row.full_name?.trim() || [row.first_name, row.last_name].filter(Boolean).join(" ").trim() || "Unnamed CSP";
}

function servicePracticeLabel(state: string | null) {
  if (state === "active_cleaning_practice") return "Active cleaning practice";
  if (state === "temporarily_not_taking_cleaning_work") return "Not taking cleaning work";
  if (state === "no_longer_taking_cleaning_work") return "No longer cleaning";
  return "Practice state unknown";
}

function applicationLabel(value: string | null) {
  if (!value) return "No application status";
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
      setPhotoUrls(
        Object.fromEntries(photoEntries.filter((entry): entry is readonly [string, string] => Boolean(entry[1])))
      );
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  const counts = useMemo(() => {
    return Object.fromEntries(
      FILTERS.map(({ key }) => [key, rows.filter((row) => matchesFilter(row, key)).length])
    ) as Record<DirectoryFilter, number>;
  }, [rows]);

  const visibleRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (!matchesFilter(row, filter)) return false;
      if (!needle) return true;
      const haystack = [
        displayName(row),
        row.full_name,
        row.first_name,
        row.last_name,
        row.preferred_name,
        row.zip_code,
        ...(row.service_area_labels ?? []),
        ...(row.languages ?? []),
        ...(row.specialties ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [rows, filter, search]);

  return (
    <main className="mx-auto max-w-[1500px]">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: adminTheme.primary }}>Cleanr ecosystem</p>
          <h1 className="mt-1 text-2xl font-semibold" style={{ color: adminTheme.textPrimary }}>CSP Directory</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6" style={{ color: adminTheme.textSecondary }}>
            Read-only organizational roster of every CSP in Cleanr. Marketplace visibility is shown as a status, not used to remove people from this directory.
          </p>
        </div>
        <div className="rounded-xl border px-4 py-3 text-right" style={{ borderColor: adminTheme.border, backgroundColor: adminTheme.card }}>
          <p className="text-2xl font-semibold" style={{ color: adminTheme.textPrimary }}>{rows.length}</p>
          <p className="text-xs" style={{ color: adminTheme.textSecondary }}>CSPs in ecosystem</p>
        </div>
      </header>

      <div className="mb-5 rounded-2xl border p-4" style={{ borderColor: adminTheme.border, backgroundColor: adminTheme.card }}>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map(({ key, label }) => {
            const active = filter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className="rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors"
                style={{
                  borderColor: active ? adminTheme.primary : adminTheme.border,
                  backgroundColor: active ? adminTheme.primary : adminTheme.surface,
                  color: active ? "#fff" : adminTheme.textPrimary,
                }}
              >
                {label} · {counts[key] ?? 0}
              </button>
            );
          })}
        </div>
        <label className="mt-4 flex max-w-xl items-center gap-2 rounded-xl border px-3" style={{ borderColor: adminTheme.border, backgroundColor: adminTheme.surface }}>
          <Search className="h-4 w-4 shrink-0" style={{ color: adminTheme.textSecondary }} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, ZIP, service area, language, specialty…"
            className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none"
            style={{ color: adminTheme.textPrimary }}
          />
        </label>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
      ) : loading ? (
        <p className="text-sm" style={{ color: adminTheme.textSecondary }}>Loading CSP directory…</p>
      ) : visibleRows.length === 0 ? (
        <div className="rounded-xl border p-6 text-center text-sm" style={{ borderColor: adminTheme.border, backgroundColor: adminTheme.card, color: adminTheme.textSecondary }}>
          No CSPs match this view.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border" style={{ borderColor: adminTheme.border, backgroundColor: adminTheme.card }}>
          <div className="grid grid-cols-[minmax(280px,1.5fr)_minmax(180px,.9fr)_minmax(260px,1.15fr)_minmax(180px,.8fr)_150px] gap-4 border-b px-5 py-3 text-[11px] font-semibold uppercase tracking-wide" style={{ borderColor: adminTheme.border, color: adminTheme.textSecondary, backgroundColor: adminTheme.surface }}>
            <span>CSP</span><span>Status</span><span>Relationship / service</span><span>Trust / profile</span><span className="text-right">Preview</span>
          </div>
          {visibleRows.map((row) => {
            const name = displayName(row);
            const initial = name.charAt(0).toUpperCase();
            const activeMarketplace = row.marketplace_access;
            const backgroundChecked = ["clear", "approved", "verified", "complete", "completed"].includes((row.background_check_status ?? "").toLowerCase());
            const identityVerified = ["verified", "approved", "clear", "complete", "completed"].includes((row.identity_status ?? "").toLowerCase());
            return (
              <div key={row.id} className="grid grid-cols-[minmax(280px,1.5fr)_minmax(180px,.9fr)_minmax(260px,1.15fr)_minmax(180px,.8fr)_150px] items-center gap-4 border-b px-5 py-4 last:border-b-0" style={{ borderColor: adminTheme.border }}>
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-slate-100 text-sm font-semibold text-slate-600" style={{ borderColor: adminTheme.border }}>
                    {photoUrls[row.id] ? <img src={photoUrls[row.id]} alt="" className="h-full w-full object-cover" /> : initial}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold" style={{ color: adminTheme.textPrimary }}>{name}</p>
                    <p className="mt-0.5 truncate text-xs" style={{ color: adminTheme.textSecondary }}>
                      {row.zip_code ? `ZIP ${row.zip_code}` : "No ZIP"}{row.service_radius_miles ? ` · ${row.service_radius_miles} mi radius` : ""}
                    </p>
                    {row.service_area_labels?.length ? <p className="mt-1 truncate text-[11px]" style={{ color: adminTheme.textSecondary }}>{row.service_area_labels.join(" · ")}</p> : null}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${activeMarketplace ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>
                    {activeMarketplace ? "Marketplace active" : "Not marketplace active"}
                  </span>
                  <p className="text-xs capitalize" style={{ color: adminTheme.textSecondary }}>{applicationLabel(row.application_status)}</p>
                  <p className="text-[11px]" style={{ color: adminTheme.textSecondary }}>{servicePracticeLabel(row.service_practice_state)}</p>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <div><p className="font-semibold" style={{ color: adminTheme.textPrimary }}>{row.completed_jobs}</p><p style={{ color: adminTheme.textSecondary }}>completed cleans</p></div>
                  <div><p className="font-semibold" style={{ color: adminTheme.textPrimary }}>{row.repeat_household_count}</p><p style={{ color: adminTheme.textSecondary }}>repeat households</p></div>
                  <div><p className="font-semibold" style={{ color: adminTheme.textPrimary }}>{row.existing_client_relationship_count}</p><p style={{ color: adminTheme.textSecondary }}>existing-client relationships</p></div>
                  <div><p className="inline-flex items-center gap-1 font-semibold" style={{ color: adminTheme.textPrimary }}><Star className="h-3.5 w-3.5" />{row.avg_rating ?? "—"}</p><p style={{ color: adminTheme.textSecondary }}>{row.review_count} reviews</p></div>
                </div>

                <div className="space-y-2 text-xs" style={{ color: adminTheme.textSecondary }}>
                  <p className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" />{identityVerified ? "Identity verified" : "Identity not verified"}</p>
                  <p className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" />{backgroundChecked ? "Background checked" : "Background not cleared"}</p>
                  <p className="flex items-center gap-1.5"><UsersRound className="h-3.5 w-3.5" />{row.profile_photo_path ? "Profile photo" : "No profile photo"}</p>
                </div>

                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => navigate(`/admin/device/customer/provider/${row.id}`)}
                    className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold"
                    style={{ borderColor: adminTheme.border, backgroundColor: adminTheme.surface, color: adminTheme.textPrimary }}
                  >
                    View as customer <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
