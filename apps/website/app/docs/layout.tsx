import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { ReactNode } from "react";
import { Brand } from "@/components/brand";
import { source } from "@/lib/source";

export default function ManualLayout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={source.pageTree}
      nav={{ title: <Brand />, url: "/" }}
      links={[
        { text: "Product", url: "/" },
        { text: "Downloads", url: "/#download" },
      ]}
    >
      <div id="main-content">{children}</div>
    </DocsLayout>
  );
}
