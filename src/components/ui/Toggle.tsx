import type { FC } from "react";

interface ToggleProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  tone?: "light" | "dark";
}

const Toggle: FC<ToggleProps> = ({ checked, onChange, disabled, tone = "light" }) => {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      className={`
        relative inline-flex h-6 w-11 items-center rounded-full transition
        ${
          checked
            ? "bg-gradient-to-r from-blue-600 to-indigo-600"
            : tone === "dark"
              ? "bg-white/25"
              : "bg-slate-300"
        }
        ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}
      `}
    >
      <span
        className={`
          inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition
          ${checked ? "translate-x-5" : "translate-x-1"}
        `}
      />
    </button>
  );
};

export default Toggle;
