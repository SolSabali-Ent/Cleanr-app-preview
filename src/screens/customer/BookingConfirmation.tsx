import { useNavigate } from "react-router-dom";
import { useBookingStore } from "../../store/bookingStore";

export default function BookingConfirmation() {
  const navigate = useNavigate();
  const { zip, date, timeSlot, providerId, totalPrice } = useBookingStore((s) => s);

  const handleDone = () => {
    navigate("/book/start");
  };

  return (
    <div className="min-h-screen bg-white flex flex-col px-6 pt-16 pb-10">
      <div className="flex-1 flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
          <span className="text-2xl">✅</span>
        </div>
        <h1 className="text-2xl font-bold mb-2">You&apos;re all set!</h1>
        <p className="text-gray-600 mb-4">
          Your cleaning is scheduled. A confirmation and reminders will be sent via
          email and SMS in the production version.
        </p>

        <div className="w-full max-w-sm border rounded-xl p-4 text-left space-y-1">
          <p className="text-sm">
            <span className="font-semibold">ZIP: </span>
            {zip}
          </p>
          <p className="text-sm">
            <span className="font-semibold">When: </span>
            {date ?? "Date not set"} @ {timeSlot ?? "Time not set"}
          </p>
          <p className="text-sm">
            <span className="font-semibold">Cleaner: </span>
            {providerId ?? "To be assigned"}
          </p>
          <p className="text-sm">
            <span className="font-semibold">Total: </span>${totalPrice}
          </p>
        </div>
      </div>

      <button
        onClick={handleDone}
        className="w-full mt-6 py-3 rounded-xl text-lg font-semibold bg-black text-white"
      >
        Back to start
      </button>
    </div>
  );
}

