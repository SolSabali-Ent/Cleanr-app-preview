import { useEffect, useMemo, useState } from "react";
import BottomSheet, { type Snap } from "../ui/BottomSheet";
import { Button } from "../ui/Button";
import { PressableRow } from "../ui/PressableRow";

type DimensionsValue = {
  bedrooms: string;
  bathrooms: string;
  sqft: string;
};

type FieldKey = keyof DimensionsValue;

type HomeDimensionsSheetProps = {
  open: boolean;
  onClose: () => void;
  value: DimensionsValue;
  onApply: (value: DimensionsValue) => void;
};

const BEDROOM_OPTIONS = [
  { value: "0", label: "0 BD" },
  { value: "1", label: "1 BD" },
  { value: "2", label: "2 BD" },
  { value: "3", label: "3 BD" },
  { value: "4", label: "4 BD" },
  { value: "5", label: "5 BD" },
  { value: "6+", label: "6+ BD" },
];

const BATHROOM_OPTIONS = [
  { value: "1", label: "1 BA" },
  { value: "1.5", label: "1.5 BA" },
  { value: "2", label: "2 BA" },
  { value: "2.5", label: "2.5 BA" },
  { value: "3", label: "3 BA" },
  { value: "3.5", label: "3.5 BA" },
  { value: "4", label: "4 BA" },
  { value: "4.5", label: "4.5 BA" },
  { value: "5+", label: "5+ BA" },
];

const SQFT_OPTIONS = [
  { value: "<500", label: "<500 sqft" },
  { value: "500-1000", label: "500–1000 sqft" },
  { value: "1000-1500", label: "1000–1500 sqft" },
  { value: "1500-2000", label: "1500–2000 sqft" },
  { value: "2000-2500", label: "2000–2500 sqft" },
  { value: "2500-3000", label: "2500–3000 sqft" },
  { value: "3000-3500", label: "3000–3500 sqft" },
  { value: "3500-4000", label: "3500–4000 sqft" },
  { value: "4000-4500", label: "4000–4500 sqft" },
  { value: "4500-5000", label: "4500–5000 sqft" },
  { value: "5000+", label: "5000+ sqft" },
];

const OPTIONS: Record<FieldKey, { value: string; label: string }[]> = {
  bedrooms: BEDROOM_OPTIONS,
  bathrooms: BATHROOM_OPTIONS,
  sqft: SQFT_OPTIONS,
};

function labelFor(field: FieldKey, value: string): string {
  const found = OPTIONS[field].find((option) => option.value === value);
  return found?.label ?? "Select";
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden>
      <path d="M5 10.5L8.3 13.8L15 7.2" stroke="#8DCC64" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export default function HomeDimensionsSheet({
  open,
  onClose,
  value,
  onApply,
}: HomeDimensionsSheetProps) {
  const [snap, setSnap] = useState<Snap>("medium");
  const [draft, setDraft] = useState<DimensionsValue>(value);
  const [activeField, setActiveField] = useState<FieldKey | null>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(value);
    setSnap("medium");
    setActiveField(null);
  }, [open, value]);

  const hasAllValues = useMemo(
    () => Boolean(draft.bedrooms && draft.bathrooms && draft.sqft),
    [draft.bedrooms, draft.bathrooms, draft.sqft]
  );

  const estimatedStart = useMemo(() => {
    const bd = Number.parseFloat(draft.bedrooms) || 1;
    const ba = Number.parseFloat(draft.bathrooms) || 1;
    const sqftBase =
      draft.sqft === "<500"
        ? 0.9
        : draft.sqft === "500-1000"
          ? 1
          : draft.sqft === "1000-1500"
            ? 1.08
            : draft.sqft === "1500-2000"
              ? 1.18
              : draft.sqft === "2000-2500"
                ? 1.3
                : 1.45;
    const estimate = Math.round((89 + bd * 14 + ba * 11) * sqftBase);
    return Number.isFinite(estimate) ? estimate : 99;
  }, [draft.bedrooms, draft.bathrooms, draft.sqft]);

  const toggleField = (field: FieldKey) => {
    const next = activeField === field ? null : field;
    setActiveField(next);
    setSnap(next ? "large" : "medium");
  };

  const selectOption = (field: FieldKey, selectedValue: string) => {
    setDraft((previous) => ({ ...previous, [field]: selectedValue }));
    setActiveField(null);
    setSnap("medium");
  };

  const apply = () => {
    onApply(draft);
    onClose();
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      snap={snap}
      setSnap={setSnap}
      title="Home Dimensions"
      subtitle="Select the size of your space to generate accurate quotes."
    >
      <div className="space-y-1">
        {(["bedrooms", "bathrooms", "sqft"] as FieldKey[]).map((field) => (
          <div key={field}>
            <PressableRow
              onClick={() => toggleField(field)}
              label={(
                <span className="dimension-label">
                  {field === "bedrooms" ? "Bedrooms" : field === "bathrooms" ? "Bathrooms" : "Square footage"}
                </span>
              )}
              rightContent={<span className="dimension-value">{labelFor(field, draft[field])}</span>}
              showChevron
              className={activeField === field ? "bg-[#F8FAFC]" : ""}
            />

            {activeField === field ? (
              <div className="dropdown-panel">
                {OPTIONS[field].map((option) => {
                  const selected = draft[field] === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={`dropdown-option ${selected ? "selected" : ""}`}
                      onClick={() => selectOption(field, option.value)}
                    >
                      <span>{option.label}</span>
                      {selected ? <CheckIcon /> : null}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="estimate-text">
        Estimated starting at ${hasAllValues ? estimatedStart : "—"}
      </div>

      <Button type="button" onClick={apply} variant="primaryBlue" size="lg" fullWidth>
        Apply
      </Button>
    </BottomSheet>
  );
}

