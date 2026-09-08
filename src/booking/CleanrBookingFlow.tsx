import { useLayoutEffect, useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { track } from "../lib/analytics";
import { clearBookingAttemptRef, ensureBookingAttemptRef } from "../lib/bookingAttemptRef";
import { emitBookingStarted, emitBookingAbandoned } from "../lib/kinex/events";
import { recordBookingProgressEvent } from "../lib/bookingProgress";
import { supabase } from "../lib/supabase";
import { BookingProvider, BOOKING_STEP_STORAGE_KEY, clearPersistedBookingDraft } from "./bookingStore";
import { WizardLayout } from "./components/WizardLayout";
import { StepZipCode } from "./steps/StepZipCode";
import { StepAddress } from "./steps/StepAddress";
import { StepService } from "./steps/StepService";
import { StepHomeDetails } from "./steps/StepHomeDetails";
import { StepFrequency } from "./steps/StepFrequency";
import { StepExtras } from "./steps/StepExtras";
import { StepDateTime } from "./steps/StepDateTime";
import { StepContact } from "./steps/StepContact";
import { StepReview } from "./steps/StepReview";

export type WizardStepId =
  | "zip"
  | "address"
  | "service"
  | "home"
  | "frequency"
  | "extras"
  | "datetime"
  | "contact"
  | "review";

const STEPS: { id: WizardStepId; title: string; subtitle?: string }[] = [
  { id: "zip", title: "Book Your Perfect Clean", subtitle: "Enter your zip code to check availability." },
  { id: "address", title: "Where are we cleaning?", subtitle: "Enter the exact service address so Cleanr can match and verify the visit location." },
  { id: "service", title: "What do you need cleaned?", subtitle: "Choose the option that best matches your home. You can adjust details later." },
  { id: "home", title: "Tell us about your home", subtitle: "Bedrooms and bathrooms help us estimate time and match the right provider." },
  { id: "frequency", title: "How often do you want cleaning?", subtitle: "Choose the schedule that best fits your household and recurring cleaning needs." },
  { id: "extras", title: "Any add-ons for this visit?", subtitle: "Inside fridge, oven, windows and more. You can customize for each clean." },
  { id: "datetime", title: "Pick a date and time", subtitle: "Choose a day and arrival window that works best for you." },
  { id: "contact", title: "Where should we send your confirmation?", subtitle: "We'll send updates and reminders about your booking to this contact." },
  { id: "review", title: "Review your booking", subtitle: "Double-check everything before you continue to payment." },
];

function initialStepIndex(): number {
  if (typeof sessionStorage === "undefined") return 0;
  const parsed = Number(sessionStorage.getItem(BOOKING_STEP_STORAGE_KEY));
  return Number.isInteger(parsed) && parsed >= 0 && parsed < STEPS.length ? parsed : 0;
}

function CleanrBookingFlowInner() {
  const navigate = useNavigate();
  const [stepIndex, setStepIndex] = useState(() => initialStepIndex());
  const totalSteps = STEPS.length;
  const current = STEPS[stepIndex];
  const hasEmittedStarted = useRef(false);

  useLayoutEffect(() => {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    window.scrollTo(0, 0);
  }, [stepIndex]);

  useEffect(() => {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(BOOKING_STEP_STORAGE_KEY, String(stepIndex));
    }
  }, [stepIndex]);

  useEffect(() => {
    if (hasEmittedStarted.current) return;
    let cancelled = false;
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled || hasEmittedStarted.current) return;
      hasEmittedStarted.current = true;
      if (user?.id) emitBookingStarted(user.id, stepIndex);
      void recordBookingProgressEvent({ eventType: "pre_booking_zip_started", currentStep: current.id });
    });
    return () => { cancelled = true; };
  }, []);

  const goNext = () => {
    track("booking_step_complete", { step: current.id });
    setStepIndex((i) => Math.min(i + 1, totalSteps - 1));
  };

  const goBack = () => {
    if (stepIndex === 0) {
      void supabase.auth.getUser().then(({ data: { user } }) => {
        if (user?.id) emitBookingAbandoned(user.id, "zip", 0);
        void recordBookingProgressEvent({
          eventType: "booking_started_no_booking_id",
          currentStep: "zip",
          metadata: { exit_action: "back_from_first_step" },
        });
        clearPersistedBookingDraft();
        clearBookingAttemptRef();
        navigate("/");
      });
    } else {
      setStepIndex((i) => Math.max(i - 1, 0));
    }
  };

  const renderStep = () => {
    switch (current.id) {
      case "zip": return <StepZipCode onNext={goNext} />;
      case "address": return <StepAddress onNext={goNext} onBack={goBack} />;
      case "service": return <StepService onNext={goNext} onBack={goBack} />;
      case "home": return <StepHomeDetails onNext={goNext} onBack={goBack} />;
      case "frequency": return <StepFrequency onNext={goNext} onBack={goBack} />;
      case "extras": return <StepExtras onNext={goNext} onBack={goBack} />;
      case "datetime": return <StepDateTime onNext={goNext} onBack={goBack} />;
      case "contact": return <StepContact onNext={goNext} onBack={goBack} />;
      case "review": return <StepReview onBack={goBack} />;
      default: return null;
    }
  };

  return (
    <WizardLayout
      stepIndex={stepIndex}
      totalSteps={totalSteps}
      title={current.title}
      subtitle={current.subtitle}
      showBack={true}
      onBack={goBack}
      bottomHint={current.id === "zip" ? "Residential cleaning • Clear booking • Reliable support" : undefined}
    >
      {renderStep()}
    </WizardLayout>
  );
}

export function CleanrBookingFlow() {
  const hasEnsuredAttempt = useRef(false);
  if (!hasEnsuredAttempt.current) {
    ensureBookingAttemptRef();
    hasEnsuredAttempt.current = true;
  }

  return (
    <BookingProvider>
      <CleanrBookingFlowInner />
    </BookingProvider>
  );
}
