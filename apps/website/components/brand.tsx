import { ArrowUpRight } from "lucide-react";

export function Brand() {
  return (
    <span className="brand">
      <span className="brand-symbol">
        <ArrowUpRight size={19} strokeWidth={2.3} aria-hidden="true" />
      </span>
      FileHop<span className="brand-period">.</span>
    </span>
  );
}
