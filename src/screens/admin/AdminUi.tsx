import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowRight, CheckCircle2, Info, Search } from "lucide-react";
import { adminTheme } from "../../theme/adminTheme";

export type AdminTone = "neutral" | "info" | "success" | "warning" | "danger";

const toneClasses: Record<AdminTone, string> = {
  neutral: "border-slate-200 bg-white text-slate-700",
  info: "border-blue-200 bg-blue-50 text-blue-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  danger: "border-red-200 bg-red-50 text-red-800",
};

const statusClasses: Record<AdminTone, string> = {
  neutral: "bg-slate-100 text-slate-700",
  info: "bg-blue-50 text-blue-700",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-700",
};

export function AdminPage({ children, width = "wide" }: { children: ReactNode; width?: "standard" | "wide" | "full" }) {
  const widthClass = width === "standard" ? "max-w-6xl" : width === "wide" ? "max-w-[1500px]" : "max-w-none";
  return <main className={`mx-auto w-full ${widthClass} space-y-6`}>{children}</main>;
}

export function AdminPageHeader({
  title,
  description,
  eyebrow,
  actions,
  meta,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-5 border-b border-slate-200 pb-5">
      <div className="min-w-0">
        {eyebrow ? <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{eyebrow}</p> : null}
        <h1 className={`${eyebrow ? "mt-1" : ""} text-2xl font-semibold tracking-[-0.02em] text-slate-950`}>{title}</h1>
        {description ? <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{description}</p> : null}
        {meta ? <div className="mt-3">{meta}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function AdminSectionHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
        {description ? <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function AdminPanel({
  children,
  className = "",
  padding = "normal",
}: {
  children: ReactNode;
  className?: string;
  padding?: "none" | "compact" | "normal";
}) {
  const paddingClass = padding === "none" ? "" : padding === "compact" ? "p-4" : "p-5";
  return <section className={`rounded-2xl border border-slate-200 bg-white ${paddingClass} ${className}`}>{children}</section>;
}

export function AdminNotice({ children, tone = "neutral" }: { children: ReactNode; tone?: AdminTone }) {
  const Icon = tone === "success" ? CheckCircle2 : tone === "danger" || tone === "warning" ? AlertCircle : Info;
  return (
    <div className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${toneClasses[tone]}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function AdminStatus({ children, tone = "neutral" }: { children: ReactNode; tone?: AdminTone }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClasses[tone]}`}>{children}</span>;
}

export function AdminPrimaryButton({
  children,
  onClick,
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#0000FE] px-3.5 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export function AdminSecondaryButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export function AdminDangerButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-red-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export function AdminTextLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1 text-xs font-semibold text-[#0000FE] hover:underline">
      {children}
      <ArrowRight className="h-3.5 w-3.5" aria-hidden />
    </Link>
  );
}

export function AdminStatStrip({
  items,
}: {
  items: Array<{ label: string; value: ReactNode; detail?: ReactNode; to?: string }>;
}) {
  return (
    <div className="grid overflow-hidden rounded-2xl border border-slate-200 bg-white sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item, index) => {
        const body = (
          <div className={`h-full px-5 py-4 ${index > 0 ? "border-t border-slate-200 sm:border-l sm:border-t-0" : ""}`}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{item.label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">{item.value}</p>
            {item.detail ? <p className="mt-1 text-xs leading-5 text-slate-500">{item.detail}</p> : null}
          </div>
        );
        return item.to ? <Link key={item.label} to={item.to} className="block hover:bg-slate-50">{body}</Link> : <div key={item.label}>{body}</div>;
      })}
    </div>
  );
}

export function AdminTabs<T extends string>({
  value,
  onChange,
  items,
}: {
  value: T;
  onChange: (value: T) => void;
  items: Array<{ value: T; label: string; count?: number }>;
}) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            className={`relative min-h-11 whitespace-nowrap px-3 text-xs font-semibold ${active ? "text-slate-950" : "text-slate-500 hover:text-slate-800"}`}
          >
            {item.label}{item.count !== undefined ? ` · ${item.count}` : ""}
            {active ? <span className="absolute inset-x-3 bottom-0 h-0.5 bg-[#0000FE]" /> : null}
          </button>
        );
      })}
    </div>
  );
}

export function AdminSearchField({
  value,
  onChange,
  placeholder = "Search…",
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <label className={`flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 ${className}`}>
      <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400"
      />
    </label>
  );
}

export function AdminEmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      {description ? <p className="mx-auto mt-1 max-w-xl text-xs leading-5 text-slate-500">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function AdminTableShell({ children }: { children: ReactNode }) {
  return <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">{children}</div>;
}

export function AdminInlineMeta({ children }: { children: ReactNode }) {
  return <span className="text-xs text-slate-500">{children}</span>;
}

export const adminUiColor = adminTheme;
