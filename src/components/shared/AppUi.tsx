import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { customerTheme } from "../../theme/customerTheme";
import { providerTheme } from "../../theme/providerTheme";

type AppTone = "customer" | "provider";

type Theme = {
  text: string;
  secondary: string;
  muted: string;
  surface: string;
  border: string;
  primary: string;
};

function themeFor(tone: AppTone): Theme {
  if (tone === "provider") {
    return {
      text: providerTheme.textPrimary,
      secondary: providerTheme.textSecondary,
      muted: providerTheme.textMuted,
      surface: providerTheme.surface,
      border: "rgba(248,250,252,.08)",
      primary: providerTheme.primary,
    };
  }

  return {
    text: customerTheme.textPrimary,
    secondary: customerTheme.textSecondary,
    muted: "#98A2B3",
    surface: customerTheme.surface,
    border: "#E4E7EC",
    primary: customerTheme.primary,
  };
}

export function AppPageHeader({
  title,
  description,
  eyebrow,
  tone = "customer",
  action,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  tone?: AppTone;
  action?: ReactNode;
}) {
  const t = themeFor(tone);
  return (
    <header className="mb-6 flex items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: t.secondary }}>{eyebrow}</p> : null}
        <h1 className={`${eyebrow ? "mt-1" : ""} text-2xl font-semibold tracking-[-0.025em]`} style={{ color: t.text }}>{title}</h1>
        {description ? <p className="mt-1 max-w-xl text-sm leading-5" style={{ color: t.secondary }}>{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

export function AppSectionHeader({
  title,
  action,
  tone = "customer",
}: {
  title: string;
  action?: ReactNode;
  tone?: AppTone;
}) {
  const t = themeFor(tone);
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-sm font-medium" style={{ color: t.secondary }}>{title}</h2>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

export function AppPanel({
  children,
  tone = "customer",
  className = "",
  padding = "normal",
}: {
  children: ReactNode;
  tone?: AppTone;
  className?: string;
  padding?: "none" | "compact" | "normal";
}) {
  const t = themeFor(tone);
  const p = padding === "none" ? "" : padding === "compact" ? "p-4" : "p-5";
  return (
    <div className={`rounded-2xl border ${p} ${className}`.trim()} style={{ backgroundColor: t.surface, borderColor: t.border }}>
      {children}
    </div>
  );
}

export function AppList({ children, tone = "customer" }: { children: ReactNode; tone?: AppTone }) {
  const t = themeFor(tone);
  return <div className="overflow-hidden rounded-2xl border" style={{ backgroundColor: t.surface, borderColor: t.border }}>{children}</div>;
}

export function AppListRow({
  title,
  description,
  leading,
  trailing,
  onClick,
  tone = "customer",
  divided = false,
}: {
  title: ReactNode;
  description?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
  tone?: AppTone;
  divided?: boolean;
}) {
  const t = themeFor(tone);
  const content = (
    <>
      {leading ? <div className="shrink-0">{leading}</div> : null}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold" style={{ color: t.text }}>{title}</div>
        {description ? <div className="mt-0.5 text-xs leading-5" style={{ color: t.secondary }}>{description}</div> : null}
      </div>
      {trailing ?? (onClick ? <ChevronRight className="h-4 w-4 shrink-0" style={{ color: t.muted }} /> : null)}
    </>
  );

  const className = `flex min-h-[68px] w-full items-center gap-3 px-4 py-3 text-left ${divided ? "border-t" : ""}`;
  const style = divided ? { borderColor: t.border } : undefined;

  if (onClick) {
    return <button type="button" onClick={onClick} className={className} style={style}>{content}</button>;
  }
  return <div className={className} style={style}>{content}</div>;
}

export function AppEmptyState({
  title,
  description,
  action,
  tone = "customer",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  tone?: AppTone;
}) {
  const t = themeFor(tone);
  return (
    <div className="border-y py-6 text-center" style={{ borderColor: t.border }}>
      <p className="text-sm font-semibold" style={{ color: t.text }}>{title}</p>
      {description ? <p className="mx-auto mt-1 max-w-sm text-xs leading-5" style={{ color: t.secondary }}>{description}</p> : null}
      {action ? <div className="mt-3 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function AppTabs<T extends string>({
  value,
  onChange,
  items,
  tone = "customer",
}: {
  value: T;
  onChange: (value: T) => void;
  items: Array<{ value: T; label: string; count?: number }>;
  tone?: AppTone;
}) {
  const t = themeFor(tone);
  return (
    <div className="mb-5 flex gap-1 overflow-x-auto border-b" style={{ borderColor: t.border }}>
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            className="relative min-h-11 whitespace-nowrap px-3 text-xs font-semibold"
            style={{ color: active ? t.text : t.secondary }}
          >
            {item.label}{item.count !== undefined ? ` · ${item.count}` : ""}
            {active ? <span className="absolute inset-x-3 bottom-0 h-0.5" style={{ backgroundColor: t.primary }} /> : null}
          </button>
        );
      })}
    </div>
  );
}

export function AppMetricStrip({
  items,
  tone = "customer",
}: {
  items: Array<{ label: string; value: ReactNode }>;
  tone?: AppTone;
}) {
  const t = themeFor(tone);
  return (
    <div className="flex overflow-hidden rounded-2xl border" style={{ backgroundColor: t.surface, borderColor: t.border }}>
      {items.map((item, index) => (
        <div key={item.label} className={`min-w-0 flex-1 px-3 py-4 text-center ${index > 0 ? "border-l" : ""}`} style={{ borderColor: t.border }}>
          <p className="text-lg font-semibold" style={{ color: t.text }}>{item.value}</p>
          <p className="mt-1 text-[10px] leading-4" style={{ color: t.secondary }}>{item.label}</p>
        </div>
      ))}
    </div>
  );
}
