import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { captureReferralCodeFromUrl, getStoredReferralCode } from "../../lib/referralRef";

type AuthMode = "signin" | "signup" | "forgot" | "reset";
type ReturnSurface = "customer" | "csp";

function modeFromSearch(value: string | null): AuthMode {
  if (value === "forgot" || value === "reset") return value;
  return "signin";
}

export default function CustomerLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnSurface: ReturnSurface = searchParams.get("from") === "csp" ? "csp" : "customer";
  const requestedMode = modeFromSearch(searchParams.get("mode"));
  const [mode, setMode] = useState<AuthMode>(requestedMode);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState(searchParams.get("email")?.trim() ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(searchParams.get("reset") === "success" ? "Password updated. Sign in with your new password." : null);
  const [hasReferral, setHasReferral] = useState(false);
  const [recoveryChecked, setRecoveryChecked] = useState(false);
  const [recoveryReady, setRecoveryReady] = useState(false);

  useEffect(() => {
    const captured = captureReferralCodeFromUrl();
    setHasReferral(Boolean(captured || getStoredReferralCode()));
  }, []);

  useEffect(() => {
    setMode(requestedMode);
    setError(null);
    const queryEmail = searchParams.get("email")?.trim();
    if (queryEmail) setEmail(queryEmail);
    if (requestedMode !== "reset") {
      setRecoveryChecked(false);
      setRecoveryReady(false);
    }
  }, [requestedMode, searchParams]);

  useEffect(() => {
    if (mode !== "reset") return;

    let active = true;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || session) {
        setRecoveryReady(Boolean(session));
        setRecoveryChecked(true);
      }
    });

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      setRecoveryReady(Boolean(data.session) && !sessionError);
      setRecoveryChecked(true);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [mode]);

  function clearMessages() {
    setError(null);
    setNotice(null);
  }

  function switchMode(nextMode: AuthMode) {
    clearMessages();
    setMode(nextMode);
  }

  async function requestPasswordReset() {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setError("Enter the email address for your Cleanr account.");
      return;
    }

    setIsLoading(true);
    clearMessages();
    try {
      const redirectUrl = new URL("/signin", window.location.origin);
      redirectUrl.searchParams.set("mode", "reset");
      redirectUrl.searchParams.set("from", returnSurface);

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: redirectUrl.toString(),
      });
      if (resetError) {
        setError(resetError.message);
        return;
      }

      setNotice("If a Cleanr account exists for that email, a password-reset link is on the way. Open the link from the same device or browser when possible.");
    } finally {
      setIsLoading(false);
    }
  }

  async function updateRecoveredPassword() {
    if (!recoveryReady) {
      setError("This password-reset session is not active. Request a new reset link and open it before setting a new password.");
      return;
    }
    if (password.length < 6) {
      setError("Use at least 6 characters for your new password.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The new passwords do not match.");
      return;
    }

    setIsLoading(true);
    clearMessages();
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        return;
      }

      await supabase.auth.signOut();
      const destination = returnSurface === "csp" ? "/csp/login?reset=success" : "/signin?reset=success";
      navigate(destination, { replace: true });
    } finally {
      setIsLoading(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (mode === "forgot") {
      await requestPasswordReset();
      return;
    }
    if (mode === "reset") {
      await updateRecoveredPassword();
      return;
    }

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

  const heading =
    mode === "signup"
      ? "Join Cleanr"
      : mode === "forgot"
        ? "Reset your password"
        : mode === "reset"
          ? "Choose a new password"
          : "Welcome back";

  const description =
    mode === "forgot"
      ? "Enter your account email and Cleanr will send a secure recovery link."
      : mode === "reset"
        ? "Set a new password for your Cleanr account."
        : hasReferral
          ? "A Cleanr CSP invited you. Sign in or create an account to continue."
          : mode === "signup"
            ? "Create your customer account to manage your cleaning relationship."
            : "Sign in to manage your bookings.";

  const showStandardTabs = mode === "signin" || mode === "signup";
  const showReferralContext = hasReferral && showStandardTabs;

  return (
    <div className="min-h-screen bg-slate-50 flex justify-center items-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/cleanr-app@2x.png" alt="Cleanr" className="h-10 object-contain mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-900">{heading}</h1>
          <p className="text-sm text-slate-600 mt-2">{description}</p>
        </div>

        {showReferralContext ? (
          <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-sm font-medium text-emerald-900">You came through a Cleanr invitation.</p>
            <p className="mt-1 text-xs leading-5 text-emerald-800">
              Nothing is connected until you authenticate. If this invitation is from a CSP you already know, accepting it preserves that existing relationship instead of treating Cleanr as its origin.
            </p>
          </div>
        ) : null}

        {showStandardTabs ? (
          <div className="mb-4 grid grid-cols-2 rounded-xl bg-slate-200 p-1 text-sm">
            <button type="button" onClick={() => switchMode("signin")} className={`rounded-lg px-3 py-2 font-medium ${mode === "signin" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}>Sign in</button>
            <button type="button" onClick={() => switchMode("signup")} className={`rounded-lg px-3 py-2 font-medium ${mode === "signup" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}>Create account</button>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-md p-6 space-y-4">
          {mode === "signup" ? (
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-slate-700 mb-1">Name</label>
              <input id="fullName" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-base placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0A84FF]" placeholder="Your name" />
            </div>
          ) : null}

          {mode !== "reset" ? (
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-base placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0A84FF]" placeholder="your@email.com" />
            </div>
          ) : null}

          {mode === "signin" || mode === "signup" ? (
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete={mode === "signup" ? "new-password" : "current-password"} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-base placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0A84FF]" placeholder="••••••••" />
            </div>
          ) : null}

          {mode === "reset" ? (
            <>
              {!recoveryChecked ? (
                <p className="text-sm text-slate-600">Opening your secure recovery session…</p>
              ) : !recoveryReady ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm font-medium text-amber-900">This reset link is not active.</p>
                  <p className="mt-1 text-xs leading-5 text-amber-800">The link may have expired or already been used. Request a new password-reset email.</p>
                </div>
              ) : (
                <>
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">New password</label>
                    <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete="new-password" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-base placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0A84FF]" placeholder="••••••••" />
                  </div>
                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-1">Confirm new password</label>
                    <input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} autoComplete="new-password" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-base placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0A84FF]" placeholder="••••••••" />
                  </div>
                </>
              )}
            </>
          ) : null}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {notice ? <p className="text-sm text-emerald-700" role="status">{notice}</p> : null}

          {mode !== "reset" || recoveryReady ? (
            <button type="submit" disabled={isLoading} className="w-full rounded-2xl bg-[#0A84FF] py-3 text-sm font-semibold text-white shadow-md shadow-[#0A84FF]/40 disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.99] transition">
              {isLoading
                ? mode === "signup"
                  ? "Creating account..."
                  : mode === "signin"
                    ? "Signing in..."
                    : mode === "forgot"
                      ? "Sending reset link..."
                      : "Updating password..."
                : mode === "signup"
                  ? "Create Cleanr account"
                  : mode === "signin"
                    ? "Sign In"
                    : mode === "forgot"
                      ? "Send reset link"
                      : "Set new password"}
            </button>
          ) : null}

          {mode === "signin" ? (
            <button type="button" onClick={() => switchMode("forgot")} className="w-full text-center text-xs font-medium text-slate-500 underline">Forgot password?</button>
          ) : null}

          {mode === "forgot" || (mode === "reset" && recoveryChecked && !recoveryReady) ? (
            <button
              type="button"
              onClick={() => {
                clearMessages();
                if (mode === "reset") setMode("forgot");
                else navigate(returnSurface === "csp" ? "/csp/login" : "/signin", { replace: true });
              }}
              className="w-full text-center text-xs font-medium text-slate-500 underline"
            >
              {mode === "reset" ? "Request a new reset link" : returnSurface === "csp" ? "Back to CSP sign in" : "Back to sign in"}
            </button>
          ) : null}
        </form>

        <div className="mt-4 text-center">
          <button onClick={() => navigate(returnSurface === "csp" ? "/csp/login" : "/")} className="text-xs text-slate-500 underline">
            {returnSurface === "csp" ? "← Back to CSP sign in" : "← Back to home"}
          </button>
        </div>
      </div>
    </div>
  );
}
