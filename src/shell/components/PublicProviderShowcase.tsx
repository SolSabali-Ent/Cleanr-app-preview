import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, Search, ShieldCheck, Star, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  listMarketplaceProvidersForZip,
  listMarketplaceProvidersPublic,
  type MarketplaceProviderChoice,
} from "../../lib/providerPresence";
import { getCustomerActivationStatus, type CustomerActivationStatus } from "../../lib/customerActivation";
import { createWaitlistLead } from "../../lib/waitlistLeads";
import { getSignedProfilePhotoUrl } from "../../lib/profilePhotoApi";
import { persistPublicProviderBookingIntent } from "../../lib/publicBookingIntent";

function displayName(provider: MarketplaceProviderChoice): string {
  return provider.preferred_name?.trim() || provider.full_name?.trim() || "Cleanr CSP";
}

function ProviderPhoto({ provider, size = "card" }: { provider: MarketplaceProviderChoice; size?: "card" | "profile" }) {
  const [url, setUrl] = useState<string | null>(null);
  const name = displayName(provider);

  useEffect(() => {
    let active = true;
    setUrl(null);
    if (!provider.profile_photo_path) return () => { active = false; };
    void getSignedProfilePhotoUrl(provider.profile_photo_path)
      .then((next) => { if (active) setUrl(next); })
      .catch(() => { if (active) setUrl(null); });
    return () => { active = false; };
  }, [provider.id, provider.profile_photo_path]);

  const dimensions = size === "profile" ? "h-28 w-28" : "h-20 w-20";
  return (
    <div className={`${dimensions} shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-100 flex items-center justify-center text-2xl font-semibold text-slate-700`}>
      {url ? (
        <img src={url} alt={`${name} profile`} className="h-full w-full object-cover" onError={() => setUrl(null)} />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </div>
  );
}

function TrustSignals({ provider }: { provider: MarketplaceProviderChoice }) {
  return (
    <div className="flex flex-wrap gap-2">
      {provider.background_checked ? <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">Background Checked</span> : null}
      {provider.insured ? <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">Insured</span> : null}
      {provider.platform_verified ? <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">Verified by Cleanr</span> : null}
    </div>
  );
}

export function PublicProviderShowcase() {
  const navigate = useNavigate();
  const [providers, setProviders] = useState<MarketplaceProviderChoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [zip, setZip] = useState("");
  const [activeZip, setActiveZip] = useState<string | null>(null);
  const [activation, setActivation] = useState<CustomerActivationStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistBusy, setWaitlistBusy] = useState(false);
  const [waitlistMessage, setWaitlistMessage] = useState<string | null>(null);
  const [profile, setProfile] = useState<MarketplaceProviderChoice | null>(null);
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [directoryProviders, setDirectoryProviders] = useState<MarketplaceProviderChoice[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [directorySearch, setDirectorySearch] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    void listMarketplaceProvidersPublic(6)
      .then((rows) => { if (active) setProviders(rows); })
      .catch(() => { if (active) setProviders([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if ((!profile && !directoryOpen) || typeof document === "undefined") return;
    const body = document.body;
    const html = document.documentElement;
    const previousBodyOverflow = body.style.overflow;
    const previousHtmlOverflow = html.style.overflow;
    body.style.overflow = "hidden";
    html.style.overflow = "hidden";
    return () => {
      body.style.overflow = previousBodyOverflow;
      html.style.overflow = previousHtmlOverflow;
    };
  }, [profile, directoryOpen]);

  const submitZip = async () => {
    const normalized = zip.trim();
    if (!/^\d{5}$/.test(normalized)) {
      setError("Enter a 5-digit ZIP code.");
      return;
    }

    setLoading(true);
    setError(null);
    setWaitlistMessage(null);
    setActivation(null);
    setActiveZip(normalized);

    try {
      const status = await getCustomerActivationStatus(normalized);
      setActivation(status);

      if (status.reason === "unsupported_zip") {
        setProviders([]);
        return;
      }

      if (status.reason === "unknown") {
        setProviders([]);
        setError("We couldn't check this ZIP right now. Please try again.");
        return;
      }

      const rows = await listMarketplaceProvidersForZip(normalized, 12);
      setProviders(rows);
      if (rows.length === 0) {
        setError(status.serviceable
          ? `Cleanr serves ${normalized}, but no CSP is available there right now.`
          : `Cleanr does not serve ${normalized} yet.`);
      }
    } catch {
      setProviders([]);
      setError("We couldn't check this ZIP right now. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const clearZip = async () => {
    setZip("");
    setActiveZip(null);
    setActivation(null);
    setError(null);
    setWaitlistEmail("");
    setWaitlistMessage(null);
    setLoading(true);
    try {
      setProviders(await listMarketplaceProvidersPublic(6));
    } catch {
      setProviders([]);
    } finally {
      setLoading(false);
    }
  };

  const requestArea = async () => {
    if (!activeZip || !activation || waitlistBusy) return;
    setWaitlistBusy(true);
    setWaitlistMessage(null);
    try {
      await createWaitlistLead({
        zip: activeZip,
        email: waitlistEmail,
        source: "provider_presence",
        activationReason: activation.reason === "unsupported_zip" ? "unsupported_zip" : "provider_supply_building",
        serviceable: activation.serviceable,
        activeProviderCount: activation.activeProviderCount,
      });
      setWaitlistMessage(`Thanks. We saved your request for ${activeZip}.`);
      setWaitlistEmail("");
    } catch (err) {
      setWaitlistMessage(err instanceof Error ? err.message : "We couldn't save your request. Please try again.");
    } finally {
      setWaitlistBusy(false);
    }
  };

  const openDirectory = async () => {
    setDirectoryOpen(true);
    setDirectorySearch("");
    setDirectoryError(null);
    setDirectoryLoading(true);
    try {
      const rows = activeZip
        ? await listMarketplaceProvidersForZip(activeZip, 50)
        : await listMarketplaceProvidersPublic(50);
      setDirectoryProviders(rows);
    } catch {
      setDirectoryProviders([]);
      setDirectoryError("We couldn't load the full CSP directory right now.");
    } finally {
      setDirectoryLoading(false);
    }
  };

  const startBookingWith = (provider: MarketplaceProviderChoice) => {
    persistPublicProviderBookingIntent({
      providerId: provider.id,
      providerName: displayName(provider),
      zip: activeZip,
    });
    setProfile(null);
    setDirectoryOpen(false);
    navigate("/book");
  };

  const visibleProviders = useMemo(() => providers.slice(0, 3), [providers]);
  const filteredDirectoryProviders = useMemo(() => {
    const query = directorySearch.trim().toLowerCase();
    if (!query) return directoryProviders;
    return directoryProviders.filter((provider) => {
      const haystack = [
        provider.full_name,
        provider.preferred_name,
        provider.provider_bio,
        ...provider.specialties,
        ...provider.service_area_labels,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [directoryProviders, directorySearch]);

  const showAreaRequest = Boolean(activeZip && activation && !activation.bookingEnabled && activation.reason !== "unknown");
  const canStartBooking = !activeZip || activation?.bookingEnabled === true;

  return (
    <>
      <section className="bg-white px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#0000FE]">How Cleanr works</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#0B1220] sm:text-4xl">From “I need a clean” to booked in a few clear steps.</h2>
            <p className="mt-4 text-lg leading-relaxed text-[#667085]">Choose the person if that matters to you. Let Cleanr handle the details around the visit.</p>
          </div>

          <div className="mt-12 grid border-y border-slate-200 md:grid-cols-3">
            {[
              { number: "01", title: "Tell us about your home", text: "Share your ZIP, service needs, and home details so Cleanr can narrow the right fit." },
              { number: "02", title: "Choose a CSP—or don't", text: "Browse real CSPs before booking, or let Cleanr match around your service needs and schedule." },
              { number: "03", title: "Pick a time and book", text: "We verify the exact address and schedule before secure payment begins." },
            ].map((step, index) => (
              <div
                key={step.number}
                className={`py-8 md:px-8 md:py-10 ${index > 0 ? "border-t border-slate-200 md:border-l md:border-t-0" : ""}`}
              >
                <p className="text-3xl font-semibold tracking-tight text-slate-300">{step.number}</p>
                <h3 className="mt-6 text-lg font-semibold text-[#0B1220]">{step.title}</h3>
                <p className="mt-2 max-w-sm text-sm leading-6 text-[#667085]">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="meet-cleanr-csps" className="bg-[#F7F9FC] px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#166534]">Meet Cleanr CSPs</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#0B1220] sm:text-4xl">See who you may be welcoming into your home</h2>
            <p className="mt-4 text-lg leading-relaxed text-[#667085]">Browse real independent residential cleaning professionals before you book. Choose someone you like, or let Cleanr match around your schedule and service needs.</p>
          </div>

          <div className="mx-auto mt-8 flex max-w-xl flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                type="tel"
                inputMode="numeric"
                maxLength={5}
                value={zip}
                onChange={(event) => { setZip(event.target.value.replace(/\D/g, "").slice(0, 5)); setError(null); setWaitlistMessage(null); }}
                onKeyDown={(event) => { if (event.key === "Enter") void submitZip(); }}
                placeholder="Enter ZIP to see who serves your area"
                className="min-h-12 w-full rounded-xl border border-slate-200 bg-white py-3 pl-12 pr-4 text-base text-[#0B1220] outline-none focus:border-[#0000FE] focus:ring-2 focus:ring-[#0000FE]/10"
              />
            </div>
            <button type="button" onClick={() => void submitZip()} className="min-h-12 rounded-xl bg-[#0000FE] px-6 font-semibold text-white">See CSPs</button>
          </div>

          {activeZip && activation?.reason === "unsupported_zip" ? (
            <div className="mx-auto mt-5 max-w-xl rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center">
              <h3 className="text-lg font-semibold text-[#0B1220]">We don&apos;t serve {activeZip} yet.</h3>
              <p className="mt-2 text-sm leading-6 text-[#667085]">Want Cleanr in your area? Add your email. Your request helps us see where people want us next.</p>
            </div>
          ) : activeZip && activation?.serviceable ? (
            <div className="mt-3 text-center text-sm text-[#667085]">
              {providers.length > 0 ? `Showing CSPs who serve ${activeZip}.` : `Checking Cleanr coverage for ${activeZip}.`} <button type="button" onClick={() => void clearZip()} className="font-semibold text-[#0000FE] underline">Show all areas</button>
            </div>
          ) : null}

          {error ? <p className="mx-auto mt-3 max-w-xl text-center text-sm text-amber-700">{error}</p> : null}

          {showAreaRequest ? (
            <div className="mx-auto mt-4 max-w-xl rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              {activation?.reason !== "unsupported_zip" ? (
                <p className="mb-3 text-center text-sm text-[#667085]">We serve this area, but we need more CSP coverage. Tell us you&apos;re waiting.</p>
              ) : null}
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="email"
                  autoComplete="email"
                  value={waitlistEmail}
                  onChange={(event) => { setWaitlistEmail(event.target.value); setWaitlistMessage(null); }}
                  placeholder="Email address"
                  className="min-h-12 flex-1 rounded-xl border border-slate-200 px-4 text-base text-[#0B1220] outline-none focus:border-[#0000FE] focus:ring-2 focus:ring-[#0000FE]/10"
                />
                <button type="button" disabled={waitlistBusy || !waitlistEmail.trim()} onClick={() => void requestArea()} className="min-h-12 rounded-xl bg-[#0000FE] px-5 font-semibold text-white disabled:opacity-50">
                  {waitlistBusy ? "Saving…" : "Request my ZIP"}
                </button>
              </div>
              {waitlistMessage ? <p className="mt-3 text-center text-sm text-[#166534]">{waitlistMessage}</p> : null}
              <button type="button" onClick={() => void clearZip()} className="mt-3 w-full text-sm font-semibold text-[#0000FE] underline">Check another ZIP</button>
            </div>
          ) : null}

          {loading ? <p className="mt-10 text-center text-sm text-[#667085]">Loading Cleanr CSPs…</p> : null}

          {!loading && visibleProviders.length > 0 ? (
            <div className="mx-auto mt-10 grid max-w-6xl gap-5 md:grid-cols-2 xl:grid-cols-3">
              {visibleProviders.map((provider) => {
                const name = displayName(provider);
                return (
                  <article key={provider.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-start gap-4">
                      <ProviderPhoto provider={provider} />
                      <div className="min-w-0 flex-1">
                        <h3 className="text-xl font-semibold text-[#0B1220]">{name}</h3>
                        <p className="mt-1 text-sm text-[#667085]">
                          {provider.avg_rating !== null && provider.review_count > 0
                            ? <span className="inline-flex items-center gap-1"><Star className="h-4 w-4 text-[#8DCC64]" />{provider.avg_rating.toFixed(1)} · {provider.review_count} reviews</span>
                            : "New to Cleanr"}
                        </p>
                        {provider.years_experience !== null ? <p className="mt-1 text-sm text-[#667085]">{provider.years_experience} years experience</p> : null}
                      </div>
                    </div>
                    <div className="mt-4"><TrustSignals provider={provider} /></div>
                    {provider.specialties.length > 0 ? <p className="mt-4 text-sm text-[#475467]">{provider.specialties.slice(0, 3).join(" · ")}</p> : null}
                    <div className="mt-5 grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => setProfile(provider)} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-[#0B1220]">View profile</button>
                      <button type="button" onClick={() => startBookingWith(provider)} className="min-h-11 rounded-xl bg-[#0000FE] px-3 text-sm font-semibold text-white">Book with {name}</button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}

          {!loading && providers.length > 0 ? (
            <div className="mt-7 text-center">
              <button
                type="button"
                onClick={() => void openDirectory()}
                className="inline-flex items-center gap-2 text-sm font-semibold text-[#0000FE] underline underline-offset-4"
              >
                {activeZip ? `View all CSPs in ${activeZip}` : "View all Cleanr CSPs"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : null}

          {canStartBooking ? (
            <div className="mt-8 text-center">
              <button type="button" onClick={() => navigate("/book")} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 font-semibold text-[#0B1220]">
                No preference? Let Cleanr match me <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : null}
        </div>
      </section>

      {directoryOpen && typeof document !== "undefined" ? createPortal(
        <div className="fixed inset-0 z-[99990] bg-white" role="dialog" aria-modal="true" aria-label={activeZip ? `Cleanr CSPs in ${activeZip}` : "Cleanr CSP directory"}>
          <div className="mx-auto flex h-[100dvh] w-full max-w-5xl flex-col overflow-hidden bg-white">
            <header className="shrink-0 border-b border-slate-200 bg-white px-5 pb-4 pt-[max(20px,env(safe-area-inset-top))] sm:px-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#166534]">{activeZip ? `CSPs serving ${activeZip}` : "Cleanr CSP directory"}</p>
                  <h2 className="mt-1 text-2xl font-bold text-[#0B1220]">Choose someone who feels like a fit</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-[#667085]">Browse the full list here. We still check the exact address and date before payment.</p>
                </div>
                <button type="button" onClick={() => setDirectoryOpen(false)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200" aria-label="Close CSP directory"><X className="h-5 w-5" /></button>
              </div>
              <div className="relative mt-4">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={directorySearch}
                  onChange={(event) => setDirectorySearch(event.target.value)}
                  placeholder="Search by name, specialty, or area"
                  className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-4 text-base text-[#0B1220] outline-none focus:border-[#0000FE] focus:ring-2 focus:ring-[#0000FE]/10"
                />
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-8">
              {directoryLoading ? <p className="py-12 text-center text-sm text-[#667085]">Loading CSPs…</p> : null}
              {directoryError ? <p className="py-8 text-center text-sm text-amber-700">{directoryError}</p> : null}
              {!directoryLoading && !directoryError && filteredDirectoryProviders.length === 0 ? <p className="py-12 text-center text-sm text-[#667085]">No CSPs match that search.</p> : null}

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredDirectoryProviders.map((provider) => {
                  const name = displayName(provider);
                  return (
                    <article key={provider.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex items-start gap-4">
                        <ProviderPhoto provider={provider} />
                        <div className="min-w-0 flex-1">
                          <h3 className="text-lg font-semibold text-[#0B1220]">{name}</h3>
                          <p className="mt-1 text-sm text-[#667085]">
                            {provider.avg_rating !== null && provider.review_count > 0
                              ? <span className="inline-flex items-center gap-1"><Star className="h-4 w-4 text-[#8DCC64]" />{provider.avg_rating.toFixed(1)} · {provider.review_count} reviews</span>
                              : "New to Cleanr"}
                          </p>
                          {provider.years_experience !== null ? <p className="mt-1 text-sm text-[#667085]">{provider.years_experience} years experience</p> : null}
                        </div>
                      </div>
                      <div className="mt-4"><TrustSignals provider={provider} /></div>
                      {provider.specialties.length > 0 ? <p className="mt-4 text-sm text-[#475467]">{provider.specialties.slice(0, 3).join(" · ")}</p> : null}
                      <div className="mt-5 grid grid-cols-2 gap-2">
                        <button type="button" onClick={() => setProfile(provider)} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-[#0B1220]">View profile</button>
                        <button type="button" onClick={() => startBookingWith(provider)} className="min-h-11 rounded-xl bg-[#0000FE] px-3 text-sm font-semibold text-white">Book with {name}</button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </div>,
        document.body,
      ) : null}

      {profile && typeof document !== "undefined" ? createPortal(
        <div className="fixed inset-0 z-[99999] flex items-end bg-black/45 sm:items-center sm:justify-center" role="dialog" aria-modal="true" aria-label={`${displayName(profile)} profile`}>
          <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 sm:max-w-xl sm:rounded-3xl">
            <div className="flex justify-end">
              <button type="button" onClick={() => setProfile(null)} className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200" aria-label="Close profile"><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-1 flex flex-col items-center text-center">
              <ProviderPhoto provider={profile} size="profile" />
              <h2 className="mt-4 text-2xl font-bold text-[#0B1220]">{displayName(profile)}</h2>
              <p className="mt-1 text-sm text-[#667085]">
                {profile.avg_rating !== null && profile.review_count > 0
                  ? `${profile.avg_rating.toFixed(1)} · ${profile.review_count} reviews`
                  : "New to Cleanr"}
              </p>
              <div className="mt-4"><TrustSignals provider={profile} /></div>
            </div>

            <div className="mt-6 space-y-4 text-sm leading-6 text-[#475467]">
              {profile.provider_bio ? <p>{profile.provider_bio}</p> : <p>This CSP has not added an introduction yet.</p>}
              {profile.years_experience !== null ? <p><span className="font-semibold text-[#0B1220]">Experience:</span> {profile.years_experience} years</p> : null}
              {profile.specialties.length > 0 ? <p><span className="font-semibold text-[#0B1220]">Strengths:</span> {profile.specialties.slice(0, 6).join(", ")}</p> : null}
              {profile.service_area_labels.length > 0 ? <p><span className="font-semibold text-[#0B1220]">Areas served:</span> {profile.service_area_labels.slice(0, 6).join(", ")}</p> : null}
              {profile.repeat_household_count > 0 ? <p><span className="font-semibold text-[#0B1220]">Repeat homes:</span> {profile.repeat_household_count} household{profile.repeat_household_count === 1 ? "" : "s"}</p> : null}
              <div className="flex items-start gap-2 rounded-xl bg-[#F3FAF1] p-3 text-[#166534]"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /><span>Choosing a CSP is a request. Cleanr checks the exact address, service, and date before payment.</span></div>
            </div>

            <button type="button" onClick={() => startBookingWith(profile)} className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0000FE] px-5 font-semibold text-white">
              Book with {displayName(profile)} <ArrowRight className="h-4 w-4" />
            </button>
            <p className="mt-3 text-center text-xs text-[#667085]">We'll keep your CSP choice while you build the booking. Sign in or create an account only when needed for payment.</p>
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  );
}
