import type { MetadataRoute } from "next";
import { basePath } from "@/lib/paths";
import { source } from "@/lib/source";

export const dynamic = "force-static";
export default function sitemap(): MetadataRoute.Sitemap {
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "https://phillippbertram.github.io";
  return [
    { url: `${origin}${basePath}/` },
    ...source.getPages().map((page) => ({ url: `${origin}${basePath}${page.url}/` })),
  ];
}
