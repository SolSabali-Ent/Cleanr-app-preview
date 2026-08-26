import { useParams } from "react-router-dom";
import { BookingMessageScreen } from "../shared/BookingMessageScreen";

export function CustomerBookingMessagePage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  return (
    <BookingMessageScreen
      variant="customer"
      backPath={bookingId ? `/app/bookings/${bookingId}` : "/app/bookings"}
      backLabel="Back to booking"
      title="Message provider"
      theme="light"
    />
  );
}
