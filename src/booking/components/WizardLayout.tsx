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
      <div className="booking-header">
        <div className="flex items-center justify-between">
          {showBack ? (
            <Button
              type="button"
              onClick={onBack}
              variant="ghost"
              size="sm"
              className="booking-back !px-0"
            >
              Back
            </Button>
          ) : (
            <span />
          )}
          <div className="booking-step text-[12px] font-medium text-[#667085]">Step {stepIndex + 1} of {totalSteps}</div>
        </div>
        <div className="booking-progress">
          <div className="booking-progress-bar" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="mb-5">
        <p className="text-xs font-semibold tracking-[0.12em] text-slate-400 uppercase">
          Book with Cleanr
        </p>
        <h1 className="mt-1 text-[22px] font-bold text-slate-900 leading-snug">{title}</h1>
        {subtitle && <p className="mt-1 text-[13px] font-medium text-[#667085]">{subtitle}</p>}
      </div>

      <div>{children}</div>

      {bottomHint && <p className="mt-5 text-[12px] font-medium text-center text-[#667085]">{bottomHint}</p>}
    </BookingShell>
  );
}

