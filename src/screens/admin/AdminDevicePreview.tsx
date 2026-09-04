import { type MouseEvent, useMemo } from "react";
import { Outlet, useLocation } from "react-router-dom";

function devicePathFromInspector(pathname: string): string {
  return pathname.replace(/^\/admin\/full-app/, "/admin/device");
}

export function AdminIframePreviewFrame() {
  const location = useLocation();
  const surface = location.pathname.includes("/customer")
    ? "Customer app"
    : location.pathname.includes("/csp")
      ? "CSP app"
      : "Public / booking";

  const src = useMemo(
    () => `${devicePathFromInspector(location.pathname)}${location.search}`,
    [location.pathname, location.search]
  );

  return (
    <main className="min-h-[calc(100vh-64px)] bg-slate-100 px-4 py-5">
      <div className="mx-auto w-full max-w-[430px]">
        <div className="mb-2 flex items-center justify-between px-1 text-xs font-medium text-slate-500">
          <span>Mobile preview · {surface}</span>
          <span>390 × 844</span>
        </div>

        <div
          className="mx-auto w-full max-w-[390px] overflow-hidden rounded-[32px] border-[10px] border-white bg-white shadow-xl ring-1 ring-slate-300"
          style={{ height: "min(844px, calc(100dvh - 145px))", minHeight: "600px" }}
        >
          <iframe
            key={src}
            src={src}
            title={`Super Admin ${surface} mobile preview`}
            className="block h-full w-full border-0 bg-white"
          />
        </div>

        <p className="mt-3 px-3 text-center text-[11px] leading-4 text-slate-500">
          True mobile viewport. Route gates are bypassed for inspection; data permissions remain unchanged.
        </p>
      </div>
    </main>
  );
}

function isBackControl(control: HTMLElement): boolean {
  const label = [
    control.getAttribute("aria-label"),
    control.getAttribute("title"),
    control.textContent,
  ]
    .filter(Boolean)
    .join(" ")
    .trim()
    .toLowerCase();

  return (
    label === "back" ||
    label.startsWith("back ") ||
    label.includes("go back") ||
    Boolean(control.querySelector("svg.lucide-arrow-left"))
  );
}

export function AdminDeviceSurface() {
  const handleClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    const control = target?.closest<HTMLElement>("button, a");
    if (!control || !isBackControl(control)) return;

    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div className="min-h-screen" onClickCapture={handleClickCapture}>
      <Outlet />
    </div>
  );
}
