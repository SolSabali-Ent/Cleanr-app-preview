import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { captureReferralCodeFromUrl, getStoredReferralCode } from "../../lib/referralRef";

type AuthMode = "signin" | "signup";

export default function CustomerLogin() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [hasReferral, setHasReferral] = useState(false);

  useEffect(() => {
    const captured = captureReferralCodeFromUrl();
    setHasReferral(Boolean(captured || getStoredReferralCode()));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setIsLoading(true);
    try {
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              role: "customer",
              full_name: fullName.trim() || undefined,
            },
          },
        });
        if (signUpError) {
          setError(signUpError.message);
          return;
        }

        if (data.session) {
          navigate(hasReferral ? "/app/provider" : "/app", { replace: true });
          return;
        }

        setNotice(
          hasReferral
            ? "Check your email to confirm your Cleanr account. Your CSP invitation will still be here when you return."
            : "Check your email to confirm your Cleanr account, then sign in."
        );
        setMode("signin");
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) {
        setError(signInError.message);
        return;
      }

      navigate(hasReferral ? "/app/provider" : "/dashboard", { replace: true });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex justify-center items-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img
            src="/cleanr-app@2x.png"
            alt="Cleanr"
            className="h-10 object-contain mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold text-slate-900">
            {mode === "signup" ? "Join Cleanr" : "Welcome back"}
          </h1>
          <p className="text-sm text-slate-600 mt-2">
            {hasReferral
              ? "A Cleanr CSP invited you. Sign in or create an account to continue."
              : mode === "signup"
                ? "Create your customer account to manage your cleaning relationship."
                : "Sign in to manage your bookings."}
          </p>
        </div>

        {hasReferral ? (
          <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-sm font-medium text-emerald-900">You came through a Cleanr invitation.</p>
            <p className="mt-1 text-xs leading-5 text-emerald-800">
              Nothing is connected until you authenticate. If this invitation is from a CSP you already know, accepting it preserves that existing relationship instead of treating Cleanr as its origin.
            </p>
          </div>
        ) : null}

        <div className="mb-4 grid grid-cols-2 rounded-xl bg-slate-200 p-1 text-sm">
          <button
            type="button"
            onClick={() => { setMode("signin"); setError(null); setNotice(null); }}
            className={`rounded-lg px-3 py-2 font-medium ${mode === "signin" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => { setMode("signup"); setError(null); setNotice(null); }}
            className={`rounded-lg px-3 py-2 font-medium ${mode === "signup" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}
          >
            Create account
          </button>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-md p-6 space-y-4">
          {mode === "signup" ? (
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-slate-700 mb-1">
                Name
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-base placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0A84FF]"
                placeholder="Your name"
              />
            </div>
          ) : null}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-base placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0A84FF]"
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-base placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0A84FF]"
              placeholder="••••••••"
            />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {notice ? <p className="text-sm text-emerald-700">{notice}</p> : null}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-2xl bg-[#0A84FF] py-3 text-sm font-semibold text-white shadow-md shadow-[#0A84FF]/40 disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.99] transition"
          >
            {isLoading
              ? mode === "signup" ? "Creating account..." : "Signing in..."
              : mode === "signup" ? "Create Cleanr account" : "Sign In"}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button onClick={() => navigate("/")} className="text-xs text-slate-500 underline">
            ← Back to home
          </button>
        </div>
      </div>
    </div>
  );
}
