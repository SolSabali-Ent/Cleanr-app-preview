import type { ReactNode } from "react";
import { providerTheme } from "../../theme/providerTheme";
import { customerTheme } from "../../theme/customerTheme";

type SurfaceProps = {
  children: ReactNode;
  variant: "provider" | "customer";
  className?: string;
};

export function Surface({ children, variant, className = "" }: SurfaceProps) {
  const backgroundColor =
    variant === "provider" ? providerTheme.surface : customerTheme.surface;

  return (
    <div className={`rounded-2xl ${className}`.trim()} style={{ backgroundColor }}>
      {children}
    </div>
  );
}

