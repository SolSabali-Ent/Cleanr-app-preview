import { useNavigate } from "react-router-dom";

export function ProviderHub() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center px-6">
      <div className="flex-[0.5] min-h-0 w-full" aria-hidden />
      <div className="w-full max-w-md flex flex-col items-center text-center shrink-0">
        <img
          src="/cleanr-app@2x.png"
          alt="Cleanr"
          className="h-36 w-36 sm:h-44 sm:w-44 md:h-52 md:w-52 object-contain mb-6"
        />

        <h1 className="text-3xl font-bold text-slate-900">Cleanr for Service Providers</h1>
        <p className="mt-3 text-sm text-slate-600">
          Build reliable residential service relationships.
          <br />
          Manage work, availability, and what comes next.
        </p>

        <div className="w-full mt-8 space-y-3">
          <button
            type="button"
            onClick={() => navigate("/csp/login")}
            className="w-full min-h-[52px] rounded-2xl bg-[#0A84FF] py-4 px-6 text-base font-semibold text-white shadow-md shadow-[#0A84FF]/40 hover:opacity-95 active:scale-[0.99] transition"
          >
            Sign In →
          </button>

          <button
            type="button"
            onClick={() => navigate("/csp/signup")}
            className="w-full min-h-[52px] rounded-2xl border-2 border-slate-300 bg-white py-4 px-6 text-base font-medium text-slate-700 hover:bg-slate-50 active:scale-[0.99] transition"
          >
            Apply to Join →
          </button>
        </div>
      </div>
      <div className="flex-[1.5] min-h-0 w-full" aria-hidden />
    </div>
  );
}
