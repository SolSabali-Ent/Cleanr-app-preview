import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { captureReferralCodeFromUrl } from "../../../lib/referralRef";
import { resolveCspLoginNavigateTarget } from "../../../lib/cspPostLoginRedirect";

function initialNotice(searchParams: URLSearchParams): string | null {
  if (searchParams.get("reset") === "success") return "Password updated. Sign in with your new password.";
  if (searchParams.get("reason") === "session-ended") return "Your Cleanr session ended. Sign in again to continue.";
  return null;
}

export default function CSPLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(() => initialNotice(searchParams));

  useEffect(() => {
    captureReferralCodeFromUrl();
  }, []);

  useEffect(() => {
    const nextNotice = initialNotice(searchParams);
    if (nextNotice) setNotice(nextNotice);
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setIsLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      navigate(resolveCspLoginNavigateTarget(), { replace: true });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex justify-center items-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img
            src="/cleanr-app@2x.png"
            alt="Cleanr"
            className="h-10 object-contain mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold text-slate-900">Cleanr Service Provider</h1>
          <p className="text-sm text-slate-600 mt-2">
            Sign in to manage your jobs and earnings
          </p>
        </div>

        <form onSubmit={handleLogin} className="bg-white rounded-2xl shadow-md p-6 space-y-4">
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
              autoComplete="email"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-base
                placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0A84FF]"
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
              autoComplete="current-password"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-base
                placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0A84FF]"
              placeholder="••••••••"
            />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {notice ? <p className="text-sm text-emerald-700" role="status">{notice}</p> : null}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-2xl bg-[#0A84FF] py-3 text-sm font-semibold text-white
              shadow-md shadow-[#0A84FF]/40 disabled:opacity-60 disabled:cursor-not-allowed
              active:scale-[0.99] transition"
          >
            {isLoading ? "Signing in…" : "Sign In"}
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => navigate(`/signin?mode=forgot&from=csp${email.trim() ? `&email=${encodeURIComponent(email.trim())}` : ""}`)}
              className="text-xs text-slate-500 underline"
            >
              Forgot password?
            </button>
          </div>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-slate-600">
            Don't have an account?{' '}
            <button
              onClick={() => navigate('/csp/signup')}
              className="text-[#0A84FF] font-medium underline"
            >
              Sign up as a CSP
            </button>
          </p>
        </div>

        <div className="mt-4 text-center">
          <button
            onClick={() => navigate('/')}
            className="text-xs text-slate-500 underline"
          >
            ← Back to customer app
          </button>
        </div>
      </div>
    </div>
  );
}
