import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { track } from "../../../lib/analytics";
import { traceCspFlow } from "@/lib/cspFlowTrace";

const CANDIDATE_READINESS_PATH = "/csp/dashboard/candidate-readiness";

export default function CSPSignup() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationMessage, setConfirmationMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setConfirmationMessage(null);
    setIsLoading(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role: "csp",
            full_name: "",
            phone: "",
          },
        },
      });
      if (signUpError) {
        setError(signUpError.message);
        return;
      }
      if (data.user) {
        traceCspFlow("signup", {
          branch: "signup.complete",
          reason: data.session ? "session_established_profile_via_trigger" : "email_confirmation_pending_profile_via_trigger",
          uid: data.user.id,
          profileId: data.user.id,
          provider_interest_submitted_at: null,
          is_onboarded: false,
          waiver_accepted_at: null,
          csp_terms_accepted_at: null,
          identity_status: "not_started",
          readiness_status: "not_started",
          application_status: "not_started",
          application_submitted_at: null,
          application_approved_at: null,
          marketplace_access: false,
        });
        // Durable account_created Kinex truth is emitted by the CSP profile insert outbox trigger.
      }
      track("csp_signup_completed");
      if (data.session) {
        navigate(CANDIDATE_READINESS_PATH, { replace: true });
      } else if (data.user) {
        setConfirmationMessage(
          "Check your email to confirm your account, then sign in to continue provider setup.",
        );
      }
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
            Create an account to start managing jobs
          </p>
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

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
          {confirmationMessage && (
            <p className="text-sm text-slate-700" role="status">
              {confirmationMessage}
            </p>
          )}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-2xl bg-[#0A84FF] py-3 text-sm font-semibold text-white
              shadow-md shadow-[#0A84FF]/40 disabled:opacity-60 disabled:cursor-not-allowed
              active:scale-[0.99] transition"
          >
            {isLoading ? "Creating account…" : "Sign Up"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-slate-600">
            Already have an account?{' '}
            <button
              onClick={() => navigate('/csp/login')}
              className="text-[#0A84FF] font-medium underline"
            >
              Sign in
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