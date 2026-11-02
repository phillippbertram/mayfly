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
    "A thoughtful desktop app for temporary file sharing. Choose a file, scan a QR code, and download on your phone. Currently in development.",
  alternates: { canonical: `${basePath}/` },
  icons: { icon: asset("/icon.svg") },
  openGraph: {
    title: "FileHop — Your files. Just a hop away.",
    description:
      "Local file sharing, thoughtfully simple. Explore the interface preview and user manual.",
    type: "website",
    images: [
      {
        url: asset("/screenshots/dashboard.jpg"),
        width: 1280,
        height: 720,
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
