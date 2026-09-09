import { useState } from "react";
import type { FormEvent } from "react";
import { useBooking } from "../bookingStore";
import { Button } from "../../components/ui/Button";

interface StepContactProps { onNext: () => void; onBack: () => void; }

export function StepContact({ onNext }: StepContactProps) {
  const { state, update } = useBooking();
  const [name, setName] = useState(state.contact.name);
  const [email, setEmail] = useState(state.contact.email);
  const [phone, setPhone] = useState(state.contact.phone);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name || !email || !phone) return;
    update({ contact: { name, email, phone } });
    onNext();
  };

  const isValid = Boolean(name.trim() && email.trim() && phone.trim());
  const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-base text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0000FE]";
  const labelClass = "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-3">
        <label className="block">
          <span className={labelClass}>Full name</span>
          <input type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jordan Smith" className={inputClass} />
        </label>
        <label className="block">
          <span className={labelClass}>Email</span>
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={inputClass} />
        </label>
        <label className="block">
          <span className={labelClass}>Mobile number</span>
          <input type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(404) 123-4567" className={inputClass} />
        </label>
      </div>

      <Button type="submit" disabled={!isValid} variant="primaryBlue" size="lg" fullWidth>Continue</Button>
      <p className="text-center text-[10px] leading-4 text-slate-400">Used for booking updates, reminders, and receipts.</p>
    </form>
  );
}
