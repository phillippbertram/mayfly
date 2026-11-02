import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-5">
      <h3 id="settings-section-title" className="text-[15px] leading-5 font-semibold">
        {title}
      </h3>
      <p className="mt-1 text-[12px] text-muted">{description}</p>
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-medium">
        {label}
      </label>
      {children}
      {hint && <div className="text-[12px] leading-4 text-muted">{hint}</div>}
    </div>
  );
}

export function InlineMessage({
  message,
  tone,
}: {
  message: string | null;
  tone: "error" | "success" | "muted";
}) {
  return (
    <AnimatePresence initial={false}>
      {message && (
        <motion.p
          key={message}
          role={tone === "error" ? "alert" : "status"}
          initial={{ opacity: 0, height: 0, y: -4 }}
          animate={{ opacity: 1, height: "auto", y: 0 }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.18 }}
          className={cn(
            "overflow-hidden text-[12px] leading-4",
            tone === "error"
              ? "text-danger"
              : tone === "success"
                ? "text-accent-strong"
                : "text-muted",
          )}
        >
          <span className="block pt-1">{message}</span>
        </motion.p>
      )}
    </AnimatePresence>
  );
}

export const inputClass =
  "h-8 rounded-md border border-line bg-surface px-2.5 text-[13px] text-fg outline-none transition-[border-color,box-shadow] duration-150 hover:border-line-strong focus:border-accent focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_18%,transparent)] aria-[invalid=true]:border-danger aria-[invalid=true]:focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--danger)_18%,transparent)]";
