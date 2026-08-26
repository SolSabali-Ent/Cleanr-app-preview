import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { BUTTON, COLORS } from "../../design/tokens";

type ButtonVariant = "primaryBlue" | "primaryGreen" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  loading?: boolean;
  wrap?: boolean;
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>;

type VariantStyle = {
  backgroundColor: string;
  color: string;
  borderColor: string;
};

const BASE_CLASSES =
  "inline-flex items-center justify-center gap-2 border font-semibold leading-[1.2] transition " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0000FE] focus-visible:ring-offset-2 " +
  "disabled:cursor-not-allowed disabled:opacity-60";

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-sm",
};

const SIZE_STYLES: Record<ButtonSize, CSSProperties> = {
  sm: {
    minHeight: BUTTON.height.sm,
    paddingLeft: BUTTON.padX.sm,
    paddingRight: BUTTON.padX.sm,
    borderRadius: BUTTON.radius.sm,
  },
  md: {
    minHeight: BUTTON.height.md,
    paddingLeft: BUTTON.padX.md,
    paddingRight: BUTTON.padX.md,
    borderRadius: BUTTON.radius.md,
  },
  lg: {
    minHeight: BUTTON.height.lg,
    paddingLeft: BUTTON.padX.lg,
    paddingRight: BUTTON.padX.lg,
    borderRadius: BUTTON.radius.lg,
  },
};

const VARIANT_STYLES: Record<ButtonVariant, VariantStyle> = {
  primaryBlue: {
    backgroundColor: COLORS.blue,
    color: "#FFFFFF",
    borderColor: COLORS.blue,
  },
  primaryGreen: {
    backgroundColor: COLORS.green,
    color: COLORS.text,
    borderColor: COLORS.green,
  },
  secondary: {
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    borderColor: COLORS.border,
  },
  ghost: {
    backgroundColor: "transparent",
    color: COLORS.text,
    borderColor: "transparent",
  },
  danger: {
    backgroundColor: COLORS.danger,
    color: "#FFFFFF",
    borderColor: COLORS.danger,
  },
};

function cx(parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

function Spinner({ color }: { color: string }) {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke={color} strokeWidth="4" fill="none" />
      <path
        className="opacity-80"
        fill={color}
        d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4Z"
      />
    </svg>
  );
}

export function Button({
  children,
  variant = "primaryBlue",
  size = "lg",
  fullWidth = false,
  leftIcon,
  rightIcon,
  loading = false,
  wrap = false,
  className,
  type = "button",
  disabled,
  style,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const variantStyle = VARIANT_STYLES[variant];

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cx([
        BASE_CLASSES,
        SIZE_CLASSES[size],
        fullWidth && "w-full",
        wrap ? "whitespace-normal text-center py-2" : "whitespace-nowrap",
        variant === "ghost" ? "hover:bg-[#F8FAFC]" : "hover:brightness-105",
        className,
      ])}
      style={{
        ...SIZE_STYLES[size],
        fontWeight: BUTTON.font.weight,
        ...variantStyle,
        ...style,
      }}
      {...props}
    >
      {loading ? <Spinner color={variantStyle.color} /> : leftIcon ? <span className="inline-flex items-center">{leftIcon}</span> : null}
      <span>{children}</span>
      {rightIcon ? <span className="inline-flex items-center">{rightIcon}</span> : null}
    </button>
  );
}

export type { ButtonProps, ButtonVariant, ButtonSize };

