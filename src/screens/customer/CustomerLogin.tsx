import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { captureReferralCodeFromUrl } from "../../lib/referralRef";

export default function CustomerLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    captureReferralCodeFromUrl();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        setError(signInError.message);
        return;
      }

      navigate("/dashboard", { replace: true });
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
          <h1 className="text-2xl font-bold text-slate-900">Welcome back</h1>
          <p className="text-sm text-slate-600 mt-2">Sign in to manage your bookings.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-md p-6 space-y-4">
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
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-base placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0A84FF]"
              placeholder="••••••••"
            />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-2xl bg-[#0A84FF] py-3 text-sm font-semibold text-white shadow-md shadow-[#0A84FF]/40 disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.99] transition"
          >
            {isLoading ? "Signing in..." : "Sign In"}
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
