import { useEffect, useMemo, useRef, type MouseEvent } from "react";
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
          Inspector mode. In-screen interactions work; navigation away from this selected screen is locked.
        </p>
      </div>
    </main>
  );
}

function resolvesToLockedPath(value: unknown, lockedPath: string): boolean {
  if (value == null || value === "") return true;
  try {
    const url = new URL(String(value), window.location.href);
    return url.origin === window.location.origin && url.pathname === lockedPath;
  } catch {
    return false;
  }
}

export function AdminDeviceSurface() {
  const lockedPathRef = useRef(window.location.pathname);

  useEffect(() => {
    const lockedPath = lockedPathRef.current;
    const originalPushState = window.history.pushState.bind(window.history);
    const originalReplaceState = window.history.replaceState.bind(window.history);
    const originalBack = window.history.back.bind(window.history);
    const originalForward = window.history.forward.bind(window.history);
    const originalGo = window.history.go.bind(window.history);

    window.history.pushState = ((data: unknown, unused: string, url?: string | URL | null) => {
      if (!resolvesToLockedPath(url, lockedPath)) return;
      originalPushState(data, unused, url);
    }) as History["pushState"];

    window.history.replaceState = ((data: unknown, unused: string, url?: string | URL | null) => {
      if (!resolvesToLockedPath(url, lockedPath)) return;
      originalReplaceState(data, unused, url);
    }) as History["replaceState"];

    window.history.back = (() => undefined) as History["back"];
    window.history.forward = (() => undefined) as History["forward"];
    window.history.go = ((_delta?: number) => undefined) as History["go"];

    return () => {
      window.history.pushState = originalPushState as History["pushState"];
      window.history.replaceState = originalReplaceState as History["replaceState"];
      window.history.back = originalBack as History["back"];
      window.history.forward = originalForward as History["forward"];
      window.history.go = originalGo as History["go"];
    };
  }, []);

  const handleClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    const anchor = target?.closest<HTMLAnchorElement>("a[href]");
    if (!anchor) return;

    if (!resolvesToLockedPath(anchor.href, lockedPathRef.current)) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  return (
    <div className="min-h-screen" onClickCapture={handleClickCapture}>
      <Outlet />
    </div>
  );
}
