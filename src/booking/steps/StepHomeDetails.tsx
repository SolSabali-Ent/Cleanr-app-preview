import { useState } from "react";
import type { FormEvent } from "react";
import { useBooking } from "../bookingStore";
import HomeDimensionsSheet from "../../components/booking/HomeDimensionsSheet";
import { Button } from "../../components/ui/Button";
import { PressableRow } from "../../components/ui/PressableRow";

interface StepHomeDetailsProps {
  onNext: () => void;
  onBack: () => void;
}

export function StepHomeDetails({ onNext }: StepHomeDetailsProps) {
  const { state, updateHomeDetails } = useBooking();
  const [sheetOpen, setSheetOpen] = useState(false);

  const bedrooms = state.homeDetails.bedrooms || "";
  const bathrooms = state.homeDetails.bathrooms || "";
  const sqft = state.homeDetails.sqft || "";

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!bedrooms || !bathrooms) return;

    updateHomeDetails({
      bedrooms,
      bathrooms,
      sqft,
    });
    onNext();
  };

  const isValid = bedrooms && bathrooms && sqft;
  const valueLabel = isValid
    ? `${bedrooms} BD / ${bathrooms} BA / ${sqft} sqft`
    : "Add bedrooms, bathrooms, and square footage";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="dimension-label">Home size</label>
        <PressableRow
          onClick={() => setSheetOpen(true)}
          label={(
            <div>
              <p className="value">{valueLabel}</p>
              <p className="hint">Tap to edit dimensions</p>
            </div>
          )}
        />
      </div>

      <Button type="submit" disabled={!isValid} variant="primaryBlue" size="lg" fullWidth>
        Continue →
      </Button>

      <HomeDimensionsSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        value={{ bedrooms, bathrooms, sqft }}
        onApply={(next) => {
          updateHomeDetails(next);
          setSheetOpen(false);
          onNext();
        }}
      />
    </form>
  );
}
