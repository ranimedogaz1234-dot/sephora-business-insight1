import type { ReactNode } from "react";

interface CardProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}

export function Card({ title, subtitle, children, className = "" }: CardProps) {
  return (
    <section className={`rounded-xl border border-soft-pink bg-white p-5 shadow-sm ${className}`}>
      {title && <h2 className="font-display text-lg text-charcoal">{title}</h2>}
      {subtitle && <p className="mt-0.5 text-xs text-charcoal/60">{subtitle}</p>}
      <div className={title || subtitle ? "mt-4" : ""}>{children}</div>
    </section>
  );
}
