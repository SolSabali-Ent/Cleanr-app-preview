export function customerRouteForContext(currentPath: string, canonicalPath: string): string {
  if (!currentPath.startsWith("/admin/full-app/customer")) return canonicalPath;
  if (canonicalPath === "/app") return "/admin/full-app/customer";
  if (canonicalPath.startsWith("/app/")) {
    return `/admin/full-app/customer${canonicalPath.slice("/app".length)}`;
  }
  return canonicalPath;
}

export function cspRouteForContext(currentPath: string, canonicalPath: string): string {
  if (!currentPath.startsWith("/admin/full-app/csp")) return canonicalPath;

  if (canonicalPath === "/csp/dashboard") return "/admin/full-app/csp";
  if (canonicalPath.startsWith("/csp/dashboard/")) {
    return `/admin/full-app/csp${canonicalPath.slice("/csp/dashboard".length)}`;
  }

  if (canonicalPath === "/csp/growth") return "/admin/full-app/csp/growth";
  if (canonicalPath.startsWith("/csp/growth/")) {
    return `/admin/full-app/csp/growth${canonicalPath.slice("/csp/growth".length)}`;
  }

  return canonicalPath;
}
