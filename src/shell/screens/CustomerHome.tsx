import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, CalendarPlus, MessageCircle, Zap } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { AppList, AppListRow, AppPageHeader } from "../../components/shared/AppUi";
import { supabase } from "../../lib/supabase";
import { useProfile } from "../../lib/useProfile";
import type { Booking } from "../../domain/booking";
import { customerFacingServiceLabel } from "../../lib/serviceCatalog";
import { isProviderCustomerMessagingOpen } from "../../lib/providerCustomerMessaging";
import { bookingServiceDayHasPassed } from "../../lib/bookingServiceDay";

function normalizeAddress(address: unknown): string {
  if (!address) return "Address unavailable";
  if (typeof address === "string") return address;
  if (typeof address === "object") {
    const obj = address as Record<string, unknown>;
    const line = obj.address;
    if (typeof line === "string" && line.trim()) return line;
    const zip = obj.zip_code ?? obj.zip;
    if (typeof zip === "string" && zip.trim()) return `ZIP ${zip}`;
  }
  return "Address unavailable";
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

function firstName(value: string | null | undefined): string | null {
  const clean = value?.trim();
  return clean ? clean.split(/\s+/)[0] : null;
}

type HomeBookingState = {
  eyebrow: string;
  headline: string;
  note: string;
  actionLabel: string;
};

function bookingState(booking: Booking, providerName: string | null): HomeBookingState {
  const name = providerName ?? "Your cleaner";
  if (booking.status === "completed_by_provider") return { eyebrow: "Cleaning finished", headline: "Your home is ready for you.", note: `${name} has finished. Take a quick look when you're ready.`, actionLabel: "Review cleaning" };
  if (booking.status === "in_progress") return { eyebrow: "Cleaning in progress", headline: `${name} is taking care of your home.`, note: "We'll let you know when the cleaning is finished.", actionLabel: "View cleaning" };
  if (booking.provider_arrived_at) return { eyebrow: "Your cleaner has arrived", headline: `${name} is at your home.`, note: "Everything for this visit is in one place.", actionLabel: "View cleaning" };
  if (booking.provider_en_route_at) return { eyebrow: "On the way", headline: `${name} is on the way.`, note: "We'll keep the important updates right here.", actionLabel: "View cleaning" };
  return { eyebrow: "Next cleaning", headline: "You're all set.", note: providerName ? `${providerName} is scheduled for your next visit.` : "Your next visit is scheduled.", actionLabel: "View cleaning" };
}

export function CustomerHome() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const [upcoming, setUpcoming] = useState<Booking | null>(null);
  const [providerName, setProviderName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [priorityRate, setPriorityRate] = useState(0.25);
  const [priorityHours, setPriorityHours] = useState(48);

  useEffect(() => {
    let active = true;
    void supabase.rpc("get_public_booking_upsell_config").then(({ data }) => {
      if (!active || !data || typeof data !== "object") return;
      const raw = data as Record<string, unknown>;
      const rate = Number(raw.urgent_surcharge_rate);
      const hours = Number(raw.urgent_window_hours);
      if (Number.isFinite(rate) && rate >= 0) setPriorityRate(rate);
      if (Number.isFinite(hours) && hours > 0) setPriorityHours(hours);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadHome() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) {
        if (active) setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("bookings")
        .select("*")
        .eq("customer_id", user.id)
        .in("status", ["accepted", "in_progress", "completed_by_provider"])
        .order("scheduled_start", { ascending: true })
        .limit(12);

      if (!active) return;
      const rows = (data ?? []) as Record<string, unknown>[];
      const row =
        rows.find((item) => item.status === "in_progress") ??
        rows.find((item) => item.status === "completed_by_provider") ??
        rows.find((item) => item.status === "accepted" && !bookingServiceDayHasPassed({
          scheduled_start: String(item.scheduled_start ?? ""),
          service_timezone: (item.service_timezone as string | null | undefined) ?? null,
        })) ??
        null;

      if (!row) {
        setUpcoming(null);
        setProviderName(null);
        setLoading(false);
        return;
      }

      const booking: Booking = {
        id: row.id as string,
        customer_id: (row.customer_id as string) ?? null,
        provider_id: (row.provider_id as string) ?? null,
        service_type: (row.service_type as string) ?? "",
        address: normalizeAddress(row.address),
        scheduled_start: row.scheduled_start as string,
        scheduled_end: (row.scheduled_end as string) ?? null,
        service_timezone: (row.service_timezone as string | null) ?? null,
        status: row.status as Booking["status"],
        provider_en_route_at: (row.provider_en_route_at as string | null) ?? null,
        provider_arrived_at: (row.provider_arrived_at as string | null) ?? null,
        service_finished_at: (row.service_finished_at as string | null) ?? null,
        price_cents: (row.price_cents as number) ?? 0,
        created_at: row.created_at as string,
        updated_at: row.updated_at as string,
      };

      setUpcoming(booking);
      setProviderName(null);
      if (booking.provider_id) {
        const { data: provider } = await supabase.from("provider_public_profiles").select("full_name").eq("id", booking.provider_id).maybeSingle();
        if (active) setProviderName(firstName(provider?.full_name as string | null));
      }
      if (active) setLoading(false);
    }

    void loadHome();
    return () => { active = false; };
  }, []);

  const customerName = firstName(profile?.full_name);
  const dateLabel = useMemo(() => (upcoming?.scheduled_start ? formatDate(upcoming.scheduled_start) : ""), [upcoming?.scheduled_start]);
  const timeLabel = useMemo(() => (upcoming?.scheduled_start ? formatTime(upcoming.scheduled_start) : ""), [upcoming?.scheduled_start]);
  const state = useMemo(() => (upcoming ? bookingState(upcoming, providerName) : null), [upcoming, providerName]);
  const canMessage = Boolean(upcoming?.provider_id && isProviderCustomerMessagingOpen(upcoming?.status));

  return (
    <div className="pb-4 text-[#0B1220]">
      <AppPageHeader
        eyebrow={customerName ? `Hi, ${customerName}` : undefined}
        title={loading || upcoming ? "We've got you." : "Ready when you are."}
        description={loading || upcoming ? "Your next important update is right here." : "Book when you need a hand. We'll keep the rest organized."}
      />

      <section className="mb-5">
        {loading ? (
          <div className="border-y border-[#E4E7EC] py-6 text-sm text-[#667085]">Loading your home…</div>
        ) : upcoming && state ? (
          <div className="next-cleaning-card p-5">
            <p className="section-label">{state.eyebrow}</p>
            <h2 className="mt-2 text-xl font-semibold leading-6 tracking-[-0.02em]">{state.headline}</h2>
            <p className="mt-1 text-sm leading-5 text-[#667085]">{state.note}</p>

            <div className="mt-5 border-y border-[#DCEED7] py-4">
              <p className="text-base font-semibold">{customerFacingServiceLabel(upcoming.service_type)}</p>
              <p className="mt-1 text-sm text-[#667085]">{dateLabel} · {timeLabel}</p>
              {providerName ? <p className="mt-1 text-sm text-[#667085]">With {providerName}</p> : null}
            </div>

            <div className={`mt-4 grid gap-2 ${canMessage ? "grid-cols-2" : "grid-cols-1"}`}>
              <Button onClick={() => navigate(`/app/bookings/${upcoming.id}`)} variant="primaryGreen" size="md" fullWidth>{state.actionLabel}</Button>
              {canMessage ? <Button onClick={() => navigate(`/app/bookings/${upcoming.id}/message`)} variant="secondary" size="md" fullWidth>{providerName ? `Message ${providerName}` : "Message CSP"}</Button> : null}
            </div>
          </div>
        ) : (
          <div className="next-cleaning-card p-5">
            <p className="section-label">No cleaning scheduled</p>
            <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em]">Need a hand with the house?</h2>
            <p className="mt-1 text-sm text-[#667085]">Choose a time that works for you.</p>
            <Button onClick={() => navigate("/book")} variant="primaryGreen" size="lg" fullWidth className="mt-5">Book a cleaning</Button>
          </div>
        )}
      </section>

      <button
        type="button"
        onClick={() => navigate("/book?priority=urgent")}
        className="mb-4 flex w-full items-center gap-3 border-y border-[#F59E0B]/30 bg-[#FFFBEB] px-1 py-3 text-left"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FEF3C7] text-[#92400E]"><Zap className="h-4 w-4" /></div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#78350F]">Need it sooner?</p>
          <p className="mt-0.5 text-xs text-[#92400E]">Priority availability within {priorityHours} hours · +{Math.round(priorityRate * 100)}%</p>
        </div>
      </button>

      <AppList>
        <AppListRow
          title="Book another cleaning"
          description="Pick a day that works for you."
          leading={<div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#8DCC64]/15 text-[#166534]"><CalendarPlus className="h-4 w-4" /></div>}
          onClick={() => navigate("/book")}
        />
        <AppListRow
          divided
          title="All bookings"
          description="Past and upcoming cleanings."
          leading={<div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F2F4F7] text-[#475467]"><CalendarDays className="h-4 w-4" /></div>}
          onClick={() => navigate("/app/bookings")}
        />
        {upcoming?.provider_id ? (
          <AppListRow
            divided
            title={providerName ? `My CSP · ${providerName}` : "My CSP"}
            description="Relationship, history, and profile."
            leading={<div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F2F4F7] text-[#475467]"><MessageCircle className="h-4 w-4" /></div>}
            onClick={() => navigate("/app/provider")}
          />
        ) : null}
      </AppList>
    </div>
  );
}
