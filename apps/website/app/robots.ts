import type { MetadataRoute } from "next";
import { basePath } from "@/lib/paths";

export const dynamic = "force-static";
export default function robots(): MetadataRoute.Robots {
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "https://phillippbertram.github.io";
  return { rules: { userAgent: "*", allow: "/" }, sitemap: `${origin}${basePath}/sitemap.xml` };
}
