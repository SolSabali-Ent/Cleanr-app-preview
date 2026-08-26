import type { ReactNode } from "react";

type BookingLayoutProps = {
  children: ReactNode;
};

export default function BookingLayout({ children }: BookingLayoutProps) {
  return (
    <div className="booking-shell">
      <div className="booking-card">
        <div className="booking-card-inner">
          {children}
        </div>
      </div>
    </div>
  );
}

