import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

export default function LoadingScreen() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const timer = setTimeout(() => {
      const nextPath = (location.state as any)?.next ?? "/service";
      navigate(nextPath, { replace: true });
    }, 1200);

    return () => clearTimeout(timer);
  }, [navigate, location.state]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-cleanr-bg px-6">
      <div className="w-16 h-16 rounded-full border-4 border-cleanr-primary border-t-transparent animate-spin mb-6" />
      <p className="text-sm font-medium text-cleanr-text">
        Finding cleaners near you…
      </p>
      <p className="mt-2 text-xs text-gray-500 text-center max-w-xs">
        We&apos;re checking live availability so you only see real, bookable time
        slots.
      </p>
    </div>
  );
}

