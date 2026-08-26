import type { ReactNode } from "react";

type PageContainerProps = {
  children: ReactNode;
  maxWidth: number;
  className?: string;
  withBottomInset?: boolean;
};

export function PageContainer({
  children,
  maxWidth,
  className = "",
  withBottomInset = false,
}: PageContainerProps) {
  /** Clears fixed bottom nav + iOS home indicator (extra room for calendar / long forms). */
  const bottomInsetClass = withBottomInset
    ? "pb-[calc(120px+env(safe-area-inset-bottom,0px))]"
    : "";

  return (
    <div
      className={`w-full mx-auto px-6 ${bottomInsetClass} ${className}`.trim()}
      style={{ maxWidth }}
    >
      {children}
    </div>
  );
}

