import type { ReactNode } from "react";
import BookingLayout from "./BookingLayout";

type BookingShellProps = {
  children: ReactNode;
};

export default function BookingShell({ children }: BookingShellProps) {
  return <BookingLayout>{children}</BookingLayout>;
}

