import BookingShell from "../../components/booking/BookingShell";
import { Button } from "../../components/ui/Button";

interface WizardLayoutProps {
  stepIndex: number;
  totalSteps: number;
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  children: React.ReactNode;
  bottomHint?: string;
}

export function WizardLayout({
  stepIndex,
  totalSteps,
  title,
  subtitle,
  showBack = true,
  onBack,
  children,
  bottomHint,
}: WizardLayoutProps) {
  const progress = ((stepIndex + 1) / totalSteps) * 100;

  return (
    <BookingShell>
      <div className="mb-5">
        <div className="flex items-center justify-between gap-4">
          {showBack ? (
            <Button
              type="button"
              onClick={onBack}
              variant="ghost"
              size="sm"
              className="booking-back !min-h-9 !px-0 text-[#475467]"
            >
              Back
            </Button>
          ) : (
            <span />
          )}
          <p className="text-[11px] font-semibold tracking-[0.08em] text-[#98A2B3]">
            {stepIndex + 1} of {totalSteps}
          </p>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-[#EAECF0]">
          <div className="h-full rounded-full bg-[#0000FE] transition-[width] duration-200" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <header className="mb-5">
        <h1 className="text-[24px] font-semibold leading-[1.12] tracking-[-0.025em] text-[#0B1220]">{title}</h1>
        {subtitle ? <p className="mt-2 text-[13px] leading-5 text-[#667085]">{subtitle}</p> : null}
      </header>

      <div>{children}</div>

      {bottomHint ? <p className="mt-5 text-center text-[11px] font-medium text-[#98A2B3]">{bottomHint}</p> : null}
    </BookingShell>
  );
}
