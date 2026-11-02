import { createMDX } from "fumadocs-mdx/next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
if (basePath && !/^\/[a-zA-Z0-9_-]+$/.test(basePath)) {
  throw new Error("NEXT_PUBLIC_BASE_PATH must be empty or a single project path such as /filehop.");
}

const withMDX = createMDX();
const origin = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://phillippbertram.github.io");
if (
  origin.protocol !== "https:" ||
  origin.pathname !== "/" ||
  origin.search ||
  origin.hash ||
  origin.username ||
  origin.password
) {
  throw new Error(
    "NEXT_PUBLIC_SITE_URL must be a public HTTPS origin without a project path or credentials.",
  );
}
export default withMDX({
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
  reactStrictMode: true,
});
