import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, MapPin, ChevronRight } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { supabase } from "../../lib/supabase";
import type { Booking } from "../../domain/booking";
import { customerFacingServiceLabel } from "../../lib/serviceCatalog";

function normalizeAddress(address: unknown): string {
  if (!address) return "Address TBD";
  if (typeof address === "string") return address;
  if (typeof address === "object") {
    const obj = address as Record<string, unknown>;
    const line = obj.address;
    if (typeof line === "string" && line.trim()) return line;
    const zip = obj.zip_code ?? obj.zip;
    if (typeof zip === "string" && zip.trim()) return `ZIP ${zip}`;
  }
  return "Address TBD";
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString();
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

export function CustomerHome() {
  const navigate = useNavigate();
  const [upcoming, setUpcoming] = useState<Booking | null>(null);

  useEffect(() => {
    let active = true;
    async function loadNextBooking() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) return;

      const { data } = await supabase
        .from("bookings")
        .select("*")
        .eq("customer_id", user.id)
        .order("scheduled_start", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!active) return;
      if (!data) {
        setUpcoming(null);
        return;
      }

      const row = data as Record<string, unknown>;
      setUpcoming({
        id: row.id as string,
        customer_id: (row.customer_id as string) ?? null,
        provider_id: (row.provider_id as string) ?? null,
        service_type: (row.service_type as string) ?? "",
        address: normalizeAddress(row.address),
        scheduled_start: row.scheduled_start as string,
        scheduled_end: (row.scheduled_end as string) ?? null,
        status: row.status as Booking["status"],
        price_cents: (row.price_cents as number) ?? 0,
        created_at: row.created_at as string,
        updated_at: row.updated_at as string,
      });
    }
    void loadNextBooking();
    return () => {
      active = false;
    };
  }, []);

  const dateLabel = useMemo(
    () => (upcoming?.scheduled_start ? formatDate(upcoming.scheduled_start) : ""),
    [upcoming?.scheduled_start]
  );
  const timeLabel = useMemo(
    () => (upcoming?.scheduled_start ? formatTime(upcoming.scheduled_start) : ""),
    [upcoming?.scheduled_start]
  );

  return (
    <div className="text-[#0B1220]">
      <header className="mb-6 section">
        <p className="text-xs uppercase tracking-[0.25em] text-[#166534] font-medium">
          Welcome back
        </p>
        <h1 className="home-hero-title mt-1">Your home, handled.</h1>
        <p className="home-hero-sub mt-2">Manage cleanings, providers, and your space in a few taps.</p>
        <div className="hero-accent" />
      </header>

      {/* Next cleaning card */}
      <section className="mb-4 section">
        {upcoming ? (
          <button
            onClick={() => navigate(`/app/bookings/${upcoming.id}`)}
            className="w-full text-left next-cleaning-card flex flex-col gap-3"
          >
            <div className="flex items-center justify-between">
              <span className="section-label">
                Next cleaning
              </span>
              <span className="inline-flex items-center text-xs text-[#667085]">
                Details <ChevronRight className="w-3 h-3 ml-1" />
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-base font-semibold">
                  {customerFacingServiceLabel(upcoming.service_type)}
                </p>
                <p className="text-sm text-[#667085] mt-1 flex items-center gap-2">
                  <CalendarDays className="w-4 h-4" />
                  {dateLabel} · {timeLabel}
                </p>
                <p className="text-xs text-[#667085] mt-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {upcoming.address}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-[#667085]">Total</p>
                <p className="text-lg font-semibold">
                  ${((upcoming.price_cents ?? 0) / 100).toFixed(0)}
                </p>
                <p className="text-xs status-green mt-1 inline-flex items-center gap-1">
                  <span className="status-icon">✔</span> On schedule
                </p>
              </div>
            </div>
          </button>
        ) : (
          <div className="w-full provider-card">
            <p className="text-sm font-medium mb-1">No cleanings scheduled</p>
            <p className="text-xs text-[#667085] mb-3">
              Book your next visit in under 60 seconds.
            </p>
            <Button onClick={() => navigate("/book")} variant="primaryGreen" size="lg" fullWidth>
              Book a cleaning
            </Button>
          </div>
        )}
      </section>

      {/* Quick tiles */}
      <section className="grid grid-cols-2 gap-3 section">
        <div className="provider-card p-5 text-left flex h-full flex-col">
          <p className="text-xs text-[#667085] mb-1">Need something else?</p>
          <p className="text-sm font-semibold mb-[6px]">Start a new booking</p>
          <p className="text-xs text-[#667085] mb-4">Schedule your next clean in under a minute.</p>
          <Button onClick={() => navigate("/book")} variant="primaryGreen" size="md" fullWidth className="mt-auto">
            Start booking
          </Button>
        </div>

        <div className="provider-card p-5 text-left flex h-full flex-col">
          <p className="text-xs text-[#667085] mb-1">Past & upcoming</p>
          <p className="text-sm font-semibold mb-[6px]">View all bookings</p>
          <p className="text-xs text-[#667085] mb-4">Track every scheduled and completed visit.</p>
          <Button
            onClick={() => navigate("/app/bookings")}
            variant="secondary"
            size="md"
            fullWidth
            className="mt-auto"
          >
            View bookings
          </Button>
        </div>
      </section>
    </div>
  );
}

