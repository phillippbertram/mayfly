import { createFromSource } from "fumadocs-core/search/server";
import { source } from "@/lib/source";

export const dynamic = "force-static";
export const revalidate = false;
export const { staticGET: GET } = createFromSource(source, {
  buildIndex(page) {
    return {
      title: page.data.title,
      description: page.data.description ?? "",
      id: page.url,
      url: page.url,
      structuredData: page.data.structuredData,
    };
  },
});
