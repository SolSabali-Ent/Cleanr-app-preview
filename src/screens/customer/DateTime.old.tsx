import { useNavigate } from "react-router-dom";
import { useBookingStore } from "../../store/bookingStore";

const DAYS_TO_SHOW = 14;
const TIME_SLOTS = ["8:00 AM", "10:00 AM", "12:00 PM", "2:00 PM", "4:00 PM"];

function getNextDays(count: number) {
  const today = new Date();
  const days: { label: string; iso: string }[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const iso = d.toISOString().split("T")[0];
    const weekday = d.toLocaleDateString(undefined, { weekday: "short" });
    const monthDay = d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
    days.push({ label: `${weekday} ${monthDay}`, iso });
  }
  return days;
}

const DAYS = getNextDays(DAYS_TO_SHOW);

export default function DateTime() {
  const navigate = useNavigate();
  const { date, timeSlot, setDateTime } = useBookingStore((s) => ({
    date: s.date,
    timeSlot: s.timeSlot,
    setDateTime: s.setDateTime,
  }));

  const handleContinue = () => {
    if (!date || !timeSlot) return;
    navigate("/book/providers");
  };

  return (
    <div className="min-h-screen bg-white flex flex-col px-6 pt-10 pb-8">
      <header className="mb-6">
        <p className="text-xs text-gray-500">Step 5 of 7</p>
        <h1 className="text-2xl font-bold mt-1">When should we come?</h1>
        <p className="text-gray-500 mt-2">
          Choose a date and a time window that works best for you.
        </p>
      </header>

      <main className="flex-1 space-y-6">
        <section>
          <h2 className="text-sm font-semibold mb-2">Choose a date</h2>
          <div className="grid grid-cols-3 gap-2">
            {DAYS.map((d) => (
              <button
                key={d.iso}
                type="button"
                onClick={() => setDateTime(d.iso, timeSlot ?? "")}
                className={`border rounded-lg px-2 py-3 text-xs text-left ${
                  date === d.iso
                    ? "border-black bg-gray-100"
                    : "border-gray-300 bg-white"
                }`}
              >
                <span className="block font-semibold">
                  {d.label.split(" ")[0]}
                </span>
                <span className="block text-gray-500">
                  {d.label.split(" ").slice(1).join(" ")}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold mb-2">Choose a time</h2>
          <div className="grid grid-cols-2 gap-2">
            {TIME_SLOTS.map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => setDateTime(date ?? "", slot)}
                className={`border rounded-lg px-3 py-3 text-sm ${
                  timeSlot === slot
                    ? "border-black bg-gray-100"
                    : "border-gray-300 bg-white"
                }`}
              >
                {slot}
              </button>
            ))}
          </div>
        </section>
      </main>

      <button
        onClick={handleContinue}
        disabled={!date || !timeSlot}
        className={`w-full mt-4 py-3 rounded-xl text-lg font-semibold transition ${
          date && timeSlot
            ? "bg-black text-white"
            : "bg-gray-200 text-gray-500 cursor-not-allowed"
        }`}
      >
        Continue
      </button>
    </div>
  );
}

