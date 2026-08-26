import { useState } from "react";
import type { FormEvent } from "react";
import { useBooking } from "../bookingStore";
import { Button } from "../../components/ui/Button";

interface StepContactProps {
  onNext: () => void;
  onBack: () => void;
}

export function StepContact({ onNext }: StepContactProps) {
  const { state, update } = useBooking();
  const [name, setName] = useState(state.contact.name);
  const [email, setEmail] = useState(state.contact.email);
  const [phone, setPhone] = useState(state.contact.phone);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name || !email || !phone) return;

    update({
      contact: {
        name,
        email,
        phone,
      },
    });
    onNext();
  };

  const isValid = name && email && phone;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-3">
        <div>
          <label className="block text-[11px] font-medium text-slate-600 mb-1">
            Full name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Jordan Smith"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-base
              placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0000FE]"
          />
        </div>

        <div>
          <label className="block text-[11px] font-medium text-slate-600 mb-1">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-base
              placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0000FE]"
          />
        </div>

        <div>
          <label className="block text-[11px] font-medium text-slate-600 mb-1">
            Mobile number
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(404) 123-4567"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-base
              placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0000FE]"
          />
        </div>
      </div>

      <Button type="submit" disabled={!isValid} variant="primaryBlue" size="lg" fullWidth>
        Continue →
      </Button>

      <p className="text-[11px] text-center text-slate-400">
        We'll only use this to send booking updates, reminders, and receipts.
      </p>
    </form>
  );
}
