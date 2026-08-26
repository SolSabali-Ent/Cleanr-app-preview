import { useNavigate } from "react-router-dom";

/** Shared: 404. No role checks. */
export function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center px-6">
      <h1 className="text-2xl font-semibold mb-2">Page not found</h1>
      <p className="text-slate-400 text-sm mb-4">This page doesn’t exist or you don’t have access.</p>
      <button
        type="button"
        onClick={() => navigate("/")}
        className="px-4 py-2 rounded-xl bg-[#0A84FF] text-white text-sm font-medium"
      >
        Go home
      </button>
    </div>
  );
}
