import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { useProfile } from "../../../lib/useProfile";
import {
  CSP_PRIMARY_BUTTON,
  CSP_SECTION_GAP,
  CSP_TEXT_PRIMARY,
  CSP_TEXT_SECONDARY,
} from "@/theme/cspTheme";
import { traceProfileWriteStart, traceProfileWriteResult } from "@/lib/debug/profileWriteTrace";

const CSP_TERMS_VERSION = "v2";

export default function CSPTermsScreen() {
  const navigate = useNavigate();
  const { profile, refresh } = useProfile();
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAccept() {
    if (!profile || !accepted || saving) return;

    setSaving(true);
    setError(null);

    const rpcPayload = {
      p_version: CSP_TERMS_VERSION,
      p_user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    };
    const traceRpc = await traceProfileWriteStart({
      source: "CSPTermsScreen.handleAccept:accept_csp_terms",
      operation: "rpc",
      targetId: profile.id,
      payload: rpcPayload,
      cspFlowState: {
        csp_terms_accepted_at: profile.csp_terms_accepted_at,
        application_status: profile.application_status,
        is_onboarded: profile.is_onboarded,
      },
    });
    const rpcResult = await supabase.rpc("accept_csp_terms", rpcPayload);
    traceProfileWriteResult(traceRpc, rpcResult);
    const { data, error: rpcError } = rpcResult;

    if (rpcError) {
      setError(rpcError.message || "Unable to save your acceptance. Please try again.");
      setSaving(false);
      return;
    }

    const acceptedAt =
      Array.isArray(data) ? data[0]?.csp_terms_accepted_at : data?.csp_terms_accepted_at;

    if (!acceptedAt) {
      setError("Acceptance was saved, but confirmation did not complete. Please try again.");
      setSaving(false);
      return;
    }

    sessionStorage.setItem("csp_terms_accepted_pending", "true");

    try {
      await refresh();
    } catch {
      // non-blocking
    }

    setSaving(false);
    navigate("/csp/dashboard", { replace: true });
  }

  return (
    <div className="min-h-screen px-4 py-8" style={{ color: CSP_TEXT_PRIMARY }}>
      <header style={{ marginBottom: CSP_SECTION_GAP }}>
        <h1 className="text-2xl font-semibold">CSP Terms & Independent Contractor Agreement</h1>
        <p className="text-sm mt-2" style={{ color: CSP_TEXT_SECONDARY }}>
          You must accept these terms to access the provider dashboard.
        </p>
      </header>

      <section
        className="rounded-2xl border p-4 mb-6 overflow-y-auto max-h-[50vh]"
        style={{ borderColor: "rgba(248, 250, 252, 0.08)", color: CSP_TEXT_SECONDARY }}
      >
        <div className="text-sm space-y-4">
          <p>By proceeding, you acknowledge and agree to the following:</p>

          <h2 className="font-semibold mt-4" style={{ color: CSP_TEXT_PRIMARY }}>
            Independent Contractor Status
          </h2>
          <p>
            You are applying to use Cleanr as an independent contractor and independent business. You
            are not an employee, partner, agent, joint venturer, or franchisee of Cleanr.
          </p>

          <h2 className="font-semibold mt-4" style={{ color: CSP_TEXT_PRIMARY }}>
            Control of Work
          </h2>
          <p>
            Except for platform rules, customer experience requirements, safety requirements, and
            service standards, you control the manner and means by which you perform services.
          </p>

          <h2 className="font-semibold mt-4" style={{ color: CSP_TEXT_PRIMARY }}>
            No Guarantee of Work
          </h2>
          <p>
            Cleanr does not guarantee any minimum number of bookings, income level, customer
            requests, or marketplace activity.
          </p>

          <h2 className="font-semibold mt-4" style={{ color: CSP_TEXT_PRIMARY }}>
            Platform Rules
          </h2>
          <p>
            You agree to follow Cleanr&apos;s platform rules, quality standards, safety requirements,
            communication policies, and customer service expectations.
          </p>

          <h2 className="font-semibold mt-4" style={{ color: CSP_TEXT_PRIMARY }}>
            Cleanr Bookings and Relationships
          </h2>
          <p>
            A booking you accept through Cleanr must be completed and paid through Cleanr so the
            parties receive the scheduling, payment, support, dispute-resolution, and protection
            services attached to that booking. Cleanr does not claim ownership of your ongoing
            relationship with a customer outside an active Cleanr booking. If you and a customer
            choose to continue working together, Cleanr earns its continued role by providing value
            you both choose to use.
          </p>

          <h2 className="font-semibold mt-4" style={{ color: CSP_TEXT_PRIMARY }}>
            Taxes and Business Obligations
          </h2>
          <p>
            You are responsible for your own taxes, business decisions, legal compliance, tools,
            supplies, transportation, and operating expenses.
          </p>

          <h2 className="font-semibold mt-4" style={{ color: CSP_TEXT_PRIMARY }}>
            Cooperation
          </h2>
          <p>
            You agree to cooperate with Cleanr in connection with support matters, trust and safety
            reviews, investigations, complaints, disputes, or platform policy enforcement.
          </p>

          <h2 className="font-semibold mt-4" style={{ color: CSP_TEXT_PRIMARY }}>
            Account Action
          </h2>
          <p>
            Cleanr may suspend, restrict, or terminate access for fraud, false statements, safety
            concerns, misuse of an active Cleanr booking, repeated service issues, failure to
            cooperate, or violations of platform rules.
          </p>

          <h2 className="font-semibold mt-4" style={{ color: CSP_TEXT_PRIMARY }}>
            Booking Protection
          </h2>
          <p>
            For certain eligible customer bookings made and paid entirely through Cleanr, Cleanr may
            offer limited Cleanr Booking Protection under separate terms and policies. That
            protection does not change your status as an independent contractor.
          </p>

          <h2 className="font-semibold mt-4" style={{ color: CSP_TEXT_PRIMARY }}>
            Acceptance
          </h2>
          <p>
            By checking the box and continuing, you confirm that you have read and agree to these CSP
            Terms & Independent Contractor conditions.
          </p>
        </div>
      </section>

      {error ? (
        <p className="mb-4 text-sm text-red-300">{error}</p>
      ) : null}

      <label className="flex items-start gap-3 mb-6 cursor-pointer">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="mt-1 rounded border-white/20"
        />
        <span className="text-sm" style={{ color: CSP_TEXT_SECONDARY }}>
          I have read and agree to the CSP Terms & Independent Contractor Agreement.
        </span>
      </label>

      <button
        type="button"
        onClick={handleAccept}
        disabled={!profile || !accepted || saving}
        className="w-full py-3 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
        style={{ backgroundColor: CSP_PRIMARY_BUTTON }}
      >
        {saving ? "Saving…" : "Accept and Continue"}
      </button>
    </div>
  );
}
