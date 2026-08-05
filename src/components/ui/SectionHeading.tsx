import type { ReactNode } from "react";

interface SectionHeadingProps {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}

export function SectionHeading({ title, subtitle, right }: SectionHeadingProps) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div>
        <h2 className="text-[17px] font-bold text-text-primary">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[12.5px] text-text-secondary">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}
