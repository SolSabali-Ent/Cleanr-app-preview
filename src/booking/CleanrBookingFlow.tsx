import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { track } from "../lib/analytics";
import { getClientRef } from "../lib/bookingApi";
import { emitBookingStarted, emitBookingAbandoned } from "../lib/kinex/events";
import { recordBookingProgressEvent } from "../lib/bookingProgress";
import { supabase } from "../lib/supabase";
import { BookingProvider } from "./bookingStore";
import { WizardLayout } from "./components/WizardLayout";
import { StepZipCode } from "./steps/StepZipCode";
import { StepService } from "./steps/StepService";
import { StepHomeDetails } from "./steps/StepHomeDetails";
import { StepFrequency } from "./steps/StepFrequency";
import { StepExtras } from "./steps/StepExtras";
import { StepDateTime } from "./steps/StepDateTime";
import { StepContact } from "./steps/StepContact";
import { StepChooseProvider } from "./steps/StepChooseProvider";
import { StepReview } from "./steps/StepReview";

export type WizardStepId =
  | "zip"
  | "service"
  | "home"
  | "frequency"
  | "extras"
  | "datetime"
  | "contact"
  | "provider"
  | "review";

const STEPS: { id: WizardStepId; title: string; subtitle?: string }[] = [
  {
    id: "zip",
    title: "Book Your Perfect Clean",
    subtitle: "Enter your zip code to check availability.",
  },
  {
    id: "service",
    title: "What do you need cleaned?",
    subtitle:
      "Choose the option that best matches your home or space. You can adjust details later.",
  },
  {
    id: "home",
    title: "Tell us about your home",
    subtitle:
      "Bedrooms and bathrooms help us estimate time and match the right pro.",
  },
  {
    id: "frequency",
    title: "How often do you want cleaning?",
    subtitle:
      "Save more when you book weekly or bi-weekly maintenance cleanings.",
  },
  {
    id: "extras",
    title: "Any add-ons for this visit?",
    subtitle:
      "Inside fridge, oven, windows and more. You can customize for each clean.",
  },
  {
    id: "datetime",
    title: "Pick a date and time",
    subtitle: "Choose a day and arrival window that works best for you.",
  },
  {
    id: "contact",
    title: "Where should we send your confirmation?",
    subtitle:
      "We'll send updates and reminders about your booking to this contact.",
  },
  {
    id: "provider",
    title: "Choose your cleaner",
    subtitle: "All providers are vetted, background-checked, and insured.",
  },
  {
    id: "review",
    title: "Review your booking",
    subtitle: "Double-check everything before you confirm.",
  },
];

function CleanrBookingFlowInner() {
  const navigate = useNavigate();
  const [stepIndex, setStepIndex] = useState(0);
  const totalSteps = STEPS.length;
  const current = STEPS[stepIndex];
  const hasEmittedStarted = useRef(false);

  useEffect(() => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }, [stepIndex]);

  useEffect(() => {
    if (hasEmittedStarted.current) return;
    let cancelled = false;
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled || hasEmittedStarted.current) return;
      hasEmittedStarted.current = true;
      if (user?.id) emitBookingStarted(user.id, 0);
      void recordBookingProgressEvent({
        eventType: "pre_booking_zip_started",
        currentStep: "zip",
      });
    });
    return () => {
      cancelled = true;
    };
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
        navigate("/");
      });
    } else {
      setStepIndex((i) => Math.max(i - 1, 0));
    }
  };

  const renderStep = () => {
    switch (current.id) {
      case "zip":
        return <StepZipCode onNext={goNext} />;

      case "service":
        return <StepService onNext={goNext} onBack={goBack} />;

      case "home":
        return <StepHomeDetails onNext={goNext} onBack={goBack} />;

      case "frequency":
        return <StepFrequency onNext={goNext} onBack={goBack} />;

      case "extras":
        return <StepExtras onNext={goNext} onBack={goBack} />;

      case "datetime":
        return <StepDateTime onNext={goNext} onBack={goBack} />;

      case "contact":
        return <StepContact onNext={goNext} onBack={goBack} />;

      case "provider":
        return <StepChooseProvider onNext={goNext} onBack={goBack} />;

      case "review":
        return <StepReview onBack={goBack} />;

      default:
        return null;
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
      bottomHint={
        current.id === "zip"
          ? "Trusted by 5,000+ happy customers • Available in 50+ cities nationwide"
          : undefined
      }
    >
      {renderStep()}
    </WizardLayout>
  );
}

export function CleanrBookingFlow() {
  useEffect(() => {
    getClientRef();
  }, []);
  return (
    <BookingProvider>
      <CleanrBookingFlowInner />
    </BookingProvider>
  );
}
