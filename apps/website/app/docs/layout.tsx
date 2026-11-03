import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { ReactNode } from "react";
import { Brand } from "@/components/brand";
import { repositoryUrl } from "@/lib/repository";
import { source } from "@/lib/source";

export default function ManualLayout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={source.pageTree}
      nav={{ title: <Brand />, url: "/" }}
      githubUrl={repositoryUrl}
      links={[
        { text: "Product", url: "/" },
        { text: "Downloads", url: "/#download" },
      ]}
    >
      <div id="main-content">{children}</div>
    </DocsLayout>
  );
}
