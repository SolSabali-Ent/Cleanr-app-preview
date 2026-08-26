import type { ReactNode } from "react";

type SectionProps = {
  title?: string;
  children: ReactNode;
  className?: string;
};

export function Section({ title, children, className = "" }: SectionProps) {
  return (
    <section className={`space-y-3 ${className}`.trim()}>
      {title ? <h2 className="text-sm font-medium">{title}</h2> : null}
      {children}
    </section>
  );
}

