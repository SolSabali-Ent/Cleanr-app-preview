function customerPreviewPrefix(currentPath: string): string | null {
  if (currentPath.startsWith("/admin/full-app/customer")) return "/admin/full-app/customer";
  if (currentPath.startsWith("/admin/device/customer")) return "/admin/device/customer";
  return null;
}

function cspPreviewPrefix(currentPath: string): string | null {
  if (currentPath.startsWith("/admin/full-app/csp")) return "/admin/full-app/csp";
  if (currentPath.startsWith("/admin/device/csp")) return "/admin/device/csp";
  return null;
}

export function customerRouteForContext(currentPath: string, canonicalPath: string): string {
  const prefix = customerPreviewPrefix(currentPath);
  if (!prefix) return canonicalPath;

  if (canonicalPath === "/app") return prefix;
  if (canonicalPath.startsWith("/app/")) {
    return `${prefix}${canonicalPath.slice("/app".length)}`;
  }
  return canonicalPath;
}

export function cspRouteForContext(currentPath: string, canonicalPath: string): string {
  const prefix = cspPreviewPrefix(currentPath);
  if (!prefix) return canonicalPath;

  if (canonicalPath === "/csp/dashboard") return prefix;
  if (canonicalPath.startsWith("/csp/dashboard/")) {
    return `${prefix}${canonicalPath.slice("/csp/dashboard".length)}`;
  }

  if (canonicalPath === "/csp/growth") return `${prefix}/growth`;
  if (canonicalPath.startsWith("/csp/growth/")) {
    return `${prefix}/growth${canonicalPath.slice("/csp/growth".length)}`;
  }

  return canonicalPath;
}
