import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useIsAdmin } from "@/lib/useIsAdmin";
import { useSession } from "@/lib/useSession";

type MfaState = "checking" | "needs_enrollment" | "needs_challenge" | "ready" | "error";

function AdminMfaGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MfaState>("checking");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  async function refreshMfaState() {
    setState("checking");
    setMessage(null);

    const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance.error) {
      setMessage(assurance.error.message);
      setState("error");
      return;
    }
    if (assurance.data.currentLevel === "aal2") {
      setState("ready");
      return;
    }

    const factors = await supabase.auth.mfa.listFactors();
    if (factors.error) {
      setMessage(factors.error.message);
      setState("error");
      return;
    }

    const verifiedTotp = factors.data.totp.find((factor) => factor.status === "verified") ?? null;
    if (verifiedTotp) {
      setFactorId(verifiedTotp.id);
      setState("needs_challenge");
      return;
    }

    setState("needs_enrollment");
  }

  useEffect(() => {
    void refreshMfaState();
  }, []);

  async function beginEnrollment() {
    if (working) return;
    setWorking(true);
    setMessage(null);
    const result = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Cleanr admin" });
    setWorking(false);
    if (result.error) return setMessage(result.error.message);
    setFactorId(result.data.id);
    setQrCode(result.data.totp.qr_code);
    setSecret(result.data.totp.secret);
    setState("needs_challenge");
  }

  async function verify() {
    if (!factorId || !code.trim() || working) return;
    setWorking(true);
    setMessage(null);
    const result = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
    setWorking(false);
    if (result.error) return setMessage(result.error.message);
    setCode("");
    setQrCode(null);
    setSecret(null);
    await refreshMfaState();
  }

  if (state === "checking") return null;
  if (state === "ready") return <>{children}</>;

  return (
    <div className="mx-auto mt-10 max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Admin security</p>
      <h1 className="mt-2 text-xl font-semibold text-slate-950">Multi-factor authentication required</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">Cleanr requires a verified authenticator factor before platform administration is available.</p>

      {state === "needs_enrollment" ? (
        <button type="button" onClick={() => void beginEnrollment()} disabled={working} className="mt-5 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {working ? "Starting…" : "Set up authenticator"}
        </button>
      ) : null}

      {state === "needs_challenge" ? (
        <div className="mt-5 space-y-4">
          {qrCode ? <img src={qrCode} alt="Cleanr admin MFA QR code" className="h-48 w-48 rounded-lg border border-slate-200 bg-white p-2" /> : null}
          {secret ? <p className="break-all rounded-lg bg-slate-50 p-3 text-xs text-slate-600">Manual setup key: <span className="font-mono text-slate-950">{secret}</span></p> : null}
          <label className="block text-sm font-medium text-slate-800">
            Authenticator code
            <input value={code} onChange={(event) => setCode(event.target.value)} inputMode="numeric" autoComplete="one-time-code" className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-500" placeholder="123456" />
          </label>
          <button type="button" onClick={() => void verify()} disabled={!code.trim() || working} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {working ? "Verifying…" : "Verify and continue"}
          </button>
        </div>
      ) : null}

      {message ? <p className="mt-4 text-sm text-red-600">{message}</p> : null}
      {state === "error" ? <button type="button" onClick={() => void refreshMfaState()} className="mt-4 text-sm font-semibold text-slate-900">Try again</button> : null}
    </div>
  );
}

/**
 * Restricts /admin routes to users with canonical platform-admin authority,
 * then requires an AAL2 session before rendering any privileged surface.
 */
export function AdminGate({ children }: { children: ReactNode }) {
  const { session, loading: sessionLoading } = useSession();
  const { isAdmin, loading } = useIsAdmin();

  if (sessionLoading || loading) return null;
  if (!session?.user) return <Navigate to="/signin?reason=session-ended" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <AdminMfaGate>{children}</AdminMfaGate>;
}
