import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Providers } from "@/components/providers";
import { asset, basePath } from "@/lib/paths";
import "./globals.css";

const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://phillippbertram.github.io";
export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: { default: "FileHop — A little less between your devices.", template: "%s · FileHop" },
  description:
    "Temporary local file sharing from your desktop. Share files with one link, scan a QR code, or download everything as a ZIP. Public release in development.",
  alternates: { canonical: `${basePath}/` },
  icons: { icon: asset("/icon.svg") },
  openGraph: {
    title: "FileHop — Your files. Just a hop away.",
    description:
      "One file or a few. One link. One quick QR scan. Explore the current desktop features and user manual.",
    type: "website",
    images: [
      {
        url: asset("/screenshots/dashboard.jpg"),
        width: 1440,
        height: 960,
        alt: "FileHop interface preview with sample files",
      },
    ],
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
