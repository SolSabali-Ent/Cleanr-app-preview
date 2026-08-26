import { useEffect } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

export type Snap = "medium" | "large";

type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  snap: Snap;
  setSnap: (snap: Snap) => void;
  title: string;
  subtitle?: string;
  tone?: "light" | "dark";
  children: ReactNode;
};

export default function BottomSheet({
  open,
  onClose,
  snap,
  setSnap,
  title,
  subtitle,
  tone = "light",
  children,
}: BottomSheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  const isDark = tone === "dark";

  const content = (
    <div className="bottom-sheet-container">
      <div className="sheet-overlay" onClick={onClose} aria-hidden />
      <section
        role="dialog"
        aria-modal="true"
        className="bottom-sheet"
        data-sheet-tone={isDark ? "dark" : "light"}
        style={{
          maxHeight: snap === "large" ? "85dvh" : "70dvh",
          backgroundColor: isDark ? "#111827" : "#ffffff",
          borderTopColor: isDark ? "rgba(248, 250, 252, 0.12)" : "#e5e7eb",
          boxShadow: isDark
            ? "0 -10px 32px rgba(2, 6, 23, 0.6)"
            : "0 -6px 24px rgba(15, 23, 42, 0.08)",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="sheet-handle"
          onClick={() => setSnap(snap === "large" ? "medium" : "large")}
          aria-label="Adjust sheet size"
          style={{ background: isDark ? "rgba(248, 250, 252, 0.3)" : "#e5e7eb" }}
        />
        <header className="mb-3">
          <h2 className="sheet-title" style={{ color: isDark ? "#f8fafc" : "#111827" }}>
            {title}
          </h2>
          {subtitle ? (
            <p className="sheet-subtitle" style={{ color: isDark ? "#94a3b8" : "#667085" }}>
              {subtitle}
            </p>
          ) : null}
        </header>
        <div className="flex-1 min-h-0 flex flex-col space-y-4">{children}</div>
      </section>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}

