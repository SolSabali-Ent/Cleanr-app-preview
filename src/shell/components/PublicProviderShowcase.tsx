import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, Clock3, Search, ShieldCheck, Sparkles, Star, UserRoundSearch, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  listMarketplaceProvidersForZip,
  listMarketplaceProvidersPublic,
  type MarketplaceProviderChoice,
} from "../../lib/providerPresence";
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
      {provider.platform_verified ? <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">Platform Verified</span> : null}
    </div>
  );
}

export function PublicProviderShowcase() {
  const navigate = useNavigate();
  const [providers, setProviders] = useState<MarketplaceProviderChoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [zip, setZip] = useState("");
  const [activeZip, setActiveZip] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<MarketplaceProviderChoice | null>(null);

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
    if (!profile || typeof document === "undefined") return;
    const body = document.body;
    const previous = body.style.overflow;
    body.style.overflow = "hidden";
    return () => { body.style.overflow = previous; };
  }, [profile]);

  const submitZip = async () => {
    const normalized = zip.trim();
    if (!/^\d{5}$/.test(normalized)) {
      setError("Enter a 5-digit ZIP code.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await listMarketplaceProvidersForZip(normalized, 12);
      setProviders(rows);
      setActiveZip(normalized);
      if (rows.length === 0) setError("No marketplace CSPs currently cover this ZIP. You can still start a booking and let Cleanr check availability.");
    } catch {
      setError("We couldn't load CSPs for that ZIP right now.");
    } finally {
      setLoading(false);
    }
  };

  const clearZip = async () => {
    setZip("");
    setActiveZip(null);
    setError(null);
    setLoading(true);
    try {
      setProviders(await listMarketplaceProvidersPublic(6));
    } catch {
      setProviders([]);
    } finally {
      setLoading(false);
    }
  };

  const startBookingWith = (provider: MarketplaceProviderChoice) => {
    persistPublicProviderBookingIntent({
      providerId: provider.id,
      providerName: displayName(provider),
      zip: activeZip,
    });
    setProfile(null);
    navigate("/book");
  };

  const visibleProviders = useMemo(() => providers.slice(0, activeZip ? 12 : 6), [providers, activeZip]);

  return (
    <>
      <section className="bg-[#F7F9FC] px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#0000FE]">How Cleanr works</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#0B1220] sm:text-4xl">A simple way to find the right clean—and the right person</h2>
            <p className="mt-4 text-lg leading-relaxed text-[#667085]">Start with your home, choose a CSP if someone feels like a fit, then pick a time and book securely.</p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              { icon: <Sparkles className="h-6 w-6" />, number: "1", title: "Tell us about your home", text: "Share your ZIP, service needs, and home details so Cleanr can narrow the right fit." },
              { icon: <UserRoundSearch className="h-6 w-6" />, number: "2", title: "Choose a CSP—or let Cleanr match", text: "See real CSPs, their photos, experience, trust signals, and profile before you decide." },
              { icon: <Clock3 className="h-6 w-6" />, number: "3", title: "Pick a time and book", text: "Cleanr verifies the exact address and schedule before secure payment begins." },
            ].map((step) => (
              <div key={step.number} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#EEF2FF] text-[#0000FE]">{step.icon}</div>
                <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-[#166534]">Step {step.number}</p>
                <h3 className="mt-1 text-lg font-semibold text-[#0B1220]">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#667085]">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="meet-cleanr-csps" className="bg-white px-6 py-16 sm:py-20">
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
                onChange={(event) => { setZip(event.target.value.replace(/\D/g, "").slice(0, 5)); setError(null); }}
                onKeyDown={(event) => { if (event.key === "Enter") void submitZip(); }}
                placeholder="Enter ZIP to see who serves your area"
                className="min-h-12 w-full rounded-xl border border-slate-200 bg-white py-3 pl-12 pr-4 text-base text-[#0B1220] outline-none focus:border-[#0000FE] focus:ring-2 focus:ring-[#0000FE]/10"
              />
            </div>
            <button type="button" onClick={() => void submitZip()} className="min-h-12 rounded-xl bg-[#0000FE] px-6 font-semibold text-white">See CSPs</button>
          </div>
          {activeZip ? (
            <div className="mt-3 text-center text-sm text-[#667085]">
              Showing CSPs that plausibly serve {activeZip}. <button type="button" onClick={() => void clearZip()} className="font-semibold text-[#0000FE] underline">Show all</button>
            </div>
          ) : null}
          {error ? <p className="mx-auto mt-3 max-w-xl text-center text-sm text-amber-700">{error}</p> : null}

          {loading ? <p className="mt-10 text-center text-sm text-[#667085]">Loading Cleanr CSPs…</p> : null}

          {!loading && visibleProviders.length > 0 ? (
            <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
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
                            : "New to marketplace"}
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

          <div className="mt-8 text-center">
            <button type="button" onClick={() => navigate("/book")} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 font-semibold text-[#0B1220]">
              No preference? Let Cleanr match me <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

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
                  : "New to Cleanr marketplace"}
              </p>
              <div className="mt-4"><TrustSignals provider={profile} /></div>
            </div>

            <div className="mt-6 space-y-4 text-sm leading-6 text-[#475467]">
              {profile.provider_bio ? <p>{profile.provider_bio}</p> : <p>This CSP has not added an introduction yet.</p>}
              {profile.years_experience !== null ? <p><span className="font-semibold text-[#0B1220]">Experience:</span> {profile.years_experience} years</p> : null}
              {profile.specialties.length > 0 ? <p><span className="font-semibold text-[#0B1220]">Strengths:</span> {profile.specialties.slice(0, 6).join(", ")}</p> : null}
              {profile.service_area_labels.length > 0 ? <p><span className="font-semibold text-[#0B1220]">Areas served:</span> {profile.service_area_labels.slice(0, 6).join(", ")}</p> : null}
              {profile.repeat_household_count > 0 ? <p><span className="font-semibold text-[#0B1220]">Continuity:</span> {profile.repeat_household_count} repeat household{profile.repeat_household_count === 1 ? "" : "s"}</p> : null}
              <div className="flex items-start gap-2 rounded-xl bg-[#F3FAF1] p-3 text-[#166534]"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /><span>Choosing a CSP is a request. Cleanr confirms the exact address, service fit, and date/time before payment begins.</span></div>
            </div>

            <button type="button" onClick={() => startBookingWith(profile)} className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0000FE] px-5 font-semibold text-white">
              Book with {displayName(profile)} <ArrowRight className="h-4 w-4" />
            </button>
            <p className="mt-3 text-center text-xs text-[#667085]">We'll keep your CSP choice while you build the booking. Sign in or create an account only when it's needed to continue to secure payment.</p>
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  );
}
