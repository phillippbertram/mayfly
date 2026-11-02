"use client";

import { RootProvider } from "fumadocs-ui/provider/next";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { asset } from "@/lib/paths";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <RootProvider
      theme={{ defaultTheme: "dark" }}
      search={{ options: { type: "static", api: asset("/search-index.json") } }}
    >
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </RootProvider>
  );
}
