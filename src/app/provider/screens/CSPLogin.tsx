import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { captureReferralCodeFromUrl } from "../../../lib/referralRef";
import { resolveCspLoginNavigateTarget } from "../../../lib/cspPostLoginRedirect";

export default function CSPLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    captureReferralCodeFromUrl();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    console.log("authData:", authData);

    if (error) {
      console.error(error);
      return;
    }

    navigate(resolveCspLoginNavigateTarget(), { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex justify-center items-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
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

        {/* Login Form */}
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
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-base
                placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0A84FF]"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-2xl bg-[#0A84FF] py-3 text-sm font-semibold text-white
              shadow-md shadow-[#0A84FF]/40 disabled:opacity-60 disabled:cursor-not-allowed
              active:scale-[0.99] transition"
          >
            Sign In
          </button>

          <div className="text-center">
            <button
              type="button"
              className="text-xs text-slate-500 underline"
            >
              Forgot password?
            </button>
          </div>
        </form>

        {/* Sign Up Link */}
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

        {/* Back to Customer App */}
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

