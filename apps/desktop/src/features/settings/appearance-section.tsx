import { Check } from "lucide-react";
import { motion } from "motion/react";
import { RadioGroup } from "radix-ui";
import { useToast } from "../../components/ui/toast";
import type { ThemePreference } from "../../lib/backend";
import { cn } from "../../lib/cn";
import { errorMessage, useSettings, useUpdateSettings } from "../../lib/queries";
import { SectionHeader } from "./field";

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

function Miniature({ dark }: { dark: boolean }) {
  return (
    <span
      className={cn(
        "flex h-full w-full flex-col gap-1.5 p-2",
        dark ? "bg-[#0f1a1c]" : "bg-[#f5f8f7]",
      )}
    >
      <span className={cn("h-2 w-10 rounded-sm", dark ? "bg-[#26373a]" : "bg-[#dfe7e4]")} />
      <span
        className={cn(
          "flex h-4 items-center gap-1 rounded-sm px-1",
          dark ? "bg-[#152224]" : "bg-white",
        )}
      >
        <span className={cn("size-2 rounded-[2px]", dark ? "bg-[#3dd6a8]" : "bg-[#0e7c66]")} />
        <span className={cn("h-1 flex-1 rounded-full", dark ? "bg-[#26373a]" : "bg-[#dfe7e4]")} />
      </span>
      <span
        className={cn(
          "flex h-4 items-center gap-1 rounded-sm px-1",
          dark ? "bg-[#152224]" : "bg-white",
        )}
      >
        <span className={cn("size-2 rounded-[2px]", dark ? "bg-[#33474b]" : "bg-[#c7d3cf]")} />
        <span className={cn("h-1 flex-1 rounded-full", dark ? "bg-[#26373a]" : "bg-[#dfe7e4]")} />
      </span>
    </span>
  );
}

export function AppearanceSection() {
  const settings = useSettings();
  const mutation = useUpdateSettings();
  const toast = useToast();
  return (
    <div>
      <SectionHeader
        title="Appearance"
        description="Follow the system or keep Mayfly light or dark."
      />
      <RadioGroup.Root
        aria-label="Theme"
        orientation="horizontal"
        value={settings.theme}
        onValueChange={(value) =>
          mutation.mutate(
            { theme: value as ThemePreference },
            { onError: (error) => toast(errorMessage(error), "error") },
          )
        }
        className="grid grid-cols-3 gap-3"
      >
        {THEMES.map((theme) => {
          const selected = settings.theme === theme.value;
          return (
            <RadioGroup.Item
              key={theme.value}
              value={theme.value}
              className="group flex flex-col gap-2 rounded-xl text-left"
            >
              <motion.span
                whileHover={{ y: -2 }}
                transition={{ type: "spring", stiffness: 400, damping: 24 }}
                className={cn(
                  "relative block h-[84px] overflow-hidden rounded-xl border transition-[border-color,box-shadow] duration-200",
                  selected ? "border-accent" : "border-line group-hover:border-line-strong",
                )}
              >
                {theme.value === "system" ? (
                  <span className="flex h-full">
                    <span className="w-1/2 overflow-hidden">
                      <span className="block h-full w-[200%]">
                        <Miniature dark={false} />
                      </span>
                    </span>
                    <span className="relative w-1/2 overflow-hidden">
                      <span className="absolute inset-y-0 right-0 block w-[200%]">
                        <Miniature dark />
                      </span>
                    </span>
                  </span>
                ) : (
                  <Miniature dark={theme.value === "dark"} />
                )}
                {selected && (
                  <motion.span
                    layoutId="theme-ring"
                    className="pointer-events-none absolute inset-0 rounded-xl shadow-[inset_0_0_0_2px_var(--accent)]"
                    transition={{ type: "spring", stiffness: 500, damping: 38 }}
                  />
                )}
              </motion.span>
              <span className="flex items-center gap-1.5 text-[13px] font-medium">
                <span
                  className={cn(
                    "flex size-4 items-center justify-center rounded-full border transition-colors",
                    selected ? "border-accent bg-accent text-accent-fg" : "border-line-strong",
                  )}
                >
                  {selected && <Check aria-hidden="true" size={10} strokeWidth={3} />}
                </span>
                {theme.label}
              </span>
            </RadioGroup.Item>
          );
        })}
      </RadioGroup.Root>
    </div>
  );
}
