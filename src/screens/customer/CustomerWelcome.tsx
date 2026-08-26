import { useNavigate } from "react-router-dom";
import { track } from "../../lib/analytics";

export default function CustomerWelcome() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center px-6">
      {/* Top spacer smaller so content sits higher */}
      <div className="flex-[0.5] min-h-0 w-full" aria-hidden />
      <div className="w-full max-w-md flex flex-col items-center text-center shrink-0">
        {/* Logo */}
        <img
          src="/cleanr-app@2x.png"
          alt="Cleanr"
          className="h-36 w-36 sm:h-44 sm:w-44 md:h-52 md:w-52 object-contain mb-8"
        />

        <h2 className="text-lg font-medium text-slate-700 mb-8">Choose your path</h2>

        {/* CTAs: stacked, touch-friendly — centered in viewport */}
        <div className="w-full space-y-4">
          <button
            type="button"
            onClick={() => {
              track("landing_choose_customer");
              navigate("/book");
            }}
            className="w-full min-h-[52px] rounded-2xl bg-[#0A84FF] py-4 px-6 text-base font-semibold text-white shadow-md shadow-[#0A84FF]/40 hover:opacity-95 active:scale-[0.99] transition"
          >
            Get my home cleaned
          </button>

          <button
            type="button"
            onClick={() => {
              track("landing_choose_csp");
              navigate("/csp/login");
            }}
            className="w-full min-h-[52px] rounded-2xl border-2 border-slate-300 bg-white py-4 px-6 text-base font-medium text-slate-700 hover:bg-slate-50 active:scale-[0.99] transition"
          >
            Earn with Cleanr
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            track("landing_sign_in");
            navigate("/signin");
          }}
          className="mt-5 text-sm font-medium text-slate-600 underline underline-offset-2 hover:text-slate-800 transition"
        >
          Already have an account? Sign in
        </button>

        <p className="mt-8 text-sm text-slate-500">4.9 ★ average rating</p>
      </div>
      <div className="flex-[1.5] min-h-0 w-full" aria-hidden />
    </div>
  );
}
