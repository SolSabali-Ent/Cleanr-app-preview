import type { ButtonHTMLAttributes, ReactNode } from "react";
import { RADIUS, SPACE, COLORS } from "../../design/tokens";

type PressableRowProps = {
  label: ReactNode;
  rightContent?: ReactNode;
  showChevron?: boolean;
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>;

function cx(parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function PressableRow({
  label,
  rightContent,
  showChevron = true,
  className,
  type = "button",
  ...props
}: PressableRowProps) {
  return (
    <button
      type={type}
      className={cx([
        "w-full border text-left transition hover:bg-[#F8FAFC]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0000FE] focus-visible:ring-offset-2",
        "flex items-center justify-between gap-3",
        className,
      ])}
      style={{
        borderColor: COLORS.border,
        borderRadius: RADIUS.lg,
        padding: SPACE.md,
      }}
      {...props}
    >
      <span>{label}</span>
      <span className="inline-flex items-center gap-2 text-sm text-[#667085]">
        {rightContent}
        {showChevron ? <span aria-hidden>›</span> : null}
      </span>
    </button>
  );
}

export type { PressableRowProps };
